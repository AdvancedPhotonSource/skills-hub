import { randomUUID } from 'node:crypto';
import { db } from './db';
import { userById } from './auth';
import { getSkill, publish, revisionFor } from './catalog';
import {
	directoryFingerprint,
	GitHubRateLimitError,
	importDirectory,
	inspectRepository,
	type RepositorySnapshot
} from './github';
import { sha256 } from './packages';

const hour = 60 * 60 * 1000;
const lease = 5 * 60 * 1000;
type SyncState = {
	source_key: string;
	checked_revision: number;
	fingerprint: string | null;
	failures: number;
	next_check_at: number;
};

function manifest(files: { path: string; size: number; sha256: string; mode?: number }[]) {
	return JSON.stringify(
		files
			.map((file) => [file.path, file.size, file.sha256, file.mode || 0o644])
			.sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0))
	);
}

/** Backend-only batch. Immutable revision sources remain separate from monitoring state. */
export async function syncUpstreams(log: (message: string) => void = console.log) {
	const result = { updated: 0, unchanged: 0, failed: 0, deferred: 0, locked: false };
	const token = randomUUID();
	const claimed = db
		.prepare(
			`INSERT INTO upstream_sync_lock (id, token, expires_at) VALUES (1, ?, ?)
			ON CONFLICT(id) DO UPDATE SET token=excluded.token, expires_at=excluded.expires_at
			WHERE upstream_sync_lock.expires_at <= ?`
		)
		.run(token, Date.now() + lease, Date.now());
	if (!claimed.changes) return { ...result, locked: true };
	const renew = () => {
		if (
			!db
				.prepare('UPDATE upstream_sync_lock SET expires_at=? WHERE id=1 AND token=?')
				.run(Date.now() + lease, token).changes
		)
			throw new Error('Upstream worker lost its lease.');
	};
	// Network operations have shorter timeouts than the lease. Renew between each operation.
	const snapshots = new Map<string, Promise<RepositorySnapshot>>();
	let rateLimit: GitHubRateLimitError | undefined;
	try {
		const candidates = db
			.prepare(
				`SELECT s.id FROM skills s JOIN revisions r ON r.skill_id=s.id AND r.number=s.revision
				WHERE s.archived=0 AND r.source IS NOT NULL
				AND COALESCE(json_extract(s.details, '$.applicationType'), 'skill')='skill'
				ORDER BY s.id`
			)
			.all() as { id: string }[];
		for (const { id } of candidates) {
			renew();
			// An entry may have been deleted while another repository was being fetched.
			if (!db.prepare('SELECT 1 FROM skills WHERE id=? AND archived=0').get(id)) continue;
			const skill = getSkill(id);
			const source = skill.source;
			if (!source) continue;
			const key = JSON.stringify([source.repository.toLowerCase(), source.ref, source.directory]);
			const previous = db.prepare('SELECT * FROM upstream_sync WHERE skill_id=?').get(id) as
				SyncState | undefined;
			const state = previous?.source_key === key ? previous : undefined;
			if (state && state.next_check_at > Date.now()) {
				result.deferred++;
				continue;
			}
			db.prepare(
				`INSERT INTO upstream_sync (skill_id, source_key) VALUES (?, ?)
				ON CONFLICT(skill_id) DO UPDATE SET source_key=excluded.source_key`
			).run(id, key);
			try {
				if (rateLimit) throw rateLimit;
				const repositoryKey = JSON.stringify([source.repository.toLowerCase(), source.ref]);
				let pending = snapshots.get(repositoryKey);
				if (!pending) {
					pending = inspectRepository(`https://github.com/${source.repository}`, source.ref);
					snapshots.set(repositoryKey, pending);
				}
				const snapshot = await pending;
				renew();
				const fingerprint = directoryFingerprint(snapshot, source.directory);
				let revision = skill.revision;
				let changed = false;
				if (
					snapshot.commit !== source.commit &&
					!(state?.checked_revision === skill.revision && state.fingerprint === fingerprint)
				) {
					const pkg = await importDirectory(snapshot, source.directory, source.ref);
					renew();
					const files = pkg.files.map((file) => ({
						path: file.path,
						size: file.data.length,
						sha256: sha256(file.data),
						mode: file.mode
					}));
					if (manifest(files) !== manifest(revisionFor(id, skill.revision).files)) {
						const owner = userById(skill.ownerId);
						if (!owner) throw new Error('Imported skill owner no longer exists.');
						publish(owner, pkg, skill, { id, expected: skill.revision });
						revision++;
						changed = true;
					}
				}
				const now = new Date().toISOString();
				db.prepare(
					`UPDATE upstream_sync SET checked_revision=?, observed_commit=?, fingerprint=?,
					last_checked_at=?, last_success_at=?, failures=0, next_check_at=0, error=NULL WHERE skill_id=?`
				).run(revision, snapshot.commit, fingerprint, now, now, id);
				if (changed) {
					result.updated++;
					log(`Updated ${skill.name} (${id}) from ${source.commit} to ${snapshot.commit}`);
				} else result.unchanged++;
			} catch (error) {
				renew();
				if (error instanceof GitHubRateLimitError) rateLimit = error;
				const failures = (state?.failures || 0) + 1;
				const retryAt = Math.max(
					Date.now() + Math.min(24, 2 ** Math.min(failures - 1, 5)) * hour,
					rateLimit?.retryAt || 0
				);
				const message = error instanceof Error ? error.message : 'Upstream synchronization failed.';
				db.prepare(
					`UPDATE upstream_sync SET last_checked_at=?, failures=?, next_check_at=?, error=? WHERE skill_id=?`
				).run(new Date().toISOString(), failures, retryAt, message.slice(0, 1000), id);
				result.failed++;
				log(`Upstream check failed for ${skill.name} (${id}): ${message}`);
			}
		}
		return result;
	} finally {
		db.prepare('DELETE FROM upstream_sync_lock WHERE id=1 AND token=?').run(token);
	}
}
