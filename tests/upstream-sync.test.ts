import { createHash } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const directory = mkdtempSync(join(tmpdir(), 'aps-upstream-sync-'));
process.env.DATA_DIR = directory;
const { db } = await import('../src/lib/server/db');
const { userById } = await import('../src/lib/server/auth');
const { publish, getSkill, revisionFor, readPackageFile, deleteEntry, updateOwners } =
	await import('../src/lib/server/catalog');
const { inspectRepository, importDirectory } = await import('../src/lib/server/github');
const { syncUpstreams } = await import('../src/lib/server/upstream-sync');
const { validatePackage } = await import('../src/lib/server/packages');
db.prepare(
	"INSERT INTO users (id, username, display_name) VALUES ('owner', 'owner', 'Owner'), ('coowner', 'coowner', 'Co-owner')"
).run();
const owner = userById('owner')!;
const meta = {
	categories: ['python'],
	tags: ['science'],
	role: '',
	example: 'A curated example',
	contexts: ['aps'],
	relevance: 'An APS use case',
	upstreamAuthor: 'Original author'
};
const oldCommit = '1'.repeat(40);
const newCommit = '2'.repeat(40);
let commit: string;
let files: Record<string, { data: Buffer; mode: string }>;
let requests: string[];
let status: number;
let duringDownload: (() => void) | undefined;
const content = (name: string) =>
	`---\nname: ${name}\ndescription: A useful skill\n---\n# Original\n`;
const setFile = (path: string, data: string, mode = '100644') => {
	files[path] = { data: Buffer.from(data), mode };
};
const sync = () => syncUpstreams(() => {});
const state = (id: string) =>
	db.prepare('SELECT * FROM upstream_sync WHERE skill_id=?').get(id) as Record<string, unknown>;

async function seed(name = 'demo', ref = 'main') {
	const snapshot = await inspectRepository(
		'https://github.com/AdvancedPhotonSource/sync-test',
		ref
	);
	const pkg = await importDirectory(snapshot, `skills/${name}`, ref);
	return publish(owner, pkg, meta);
}

beforeEach(() => {
	for (const { id } of db.prepare('SELECT id FROM skills').all() as { id: string }[])
		deleteEntry(id, owner, getSkill(id, owner).revision);
	db.prepare('DELETE FROM upstream_sync_lock').run();
	commit = oldCommit;
	files = {};
	requests = [];
	status = 200;
	duringDownload = undefined;
	setFile('skills/demo/SKILL.md', content('demo'));
	setFile('skills/demo/scripts/run.py', 'print("original")\n', '100755');
	setFile('skills/other/SKILL.md', content('other'));
	setFile('LICENSE', 'Original license');
	vi.stubGlobal(
		'fetch',
		vi.fn(async (input: string) => {
			requests.push(input);
			if (status !== 200) return new Response('', { status, headers: { 'retry-after': '7200' } });
			const url = new URL(input);
			if (url.hostname === 'raw.githubusercontent.com') {
				const callback = duringDownload;
				duringDownload = undefined;
				callback?.();
				expect(url.pathname.split('/')[3]).toBe(commit);
				return new Response(new Uint8Array(files[url.pathname.split('/').slice(4).join('/')].data));
			}
			if (url.pathname.includes('/commits/'))
				return Response.json({
					sha: commit,
					commit: { tree: { sha: 'a'.repeat(40) }, committer: { date: '2026-11-01T00:00:00Z' } }
				});
			if (url.pathname.includes('/git/trees/'))
				return Response.json({
					tree: Object.entries(files).map(([path, file]) => ({
						path,
						type: 'blob',
						mode: file.mode,
						size: file.data.length,
						sha: createHash('sha1')
							.update(`blob ${file.data.length}\0`)
							.update(file.data)
							.digest('hex')
					}))
				});
			return Response.json({ private: false, default_branch: 'main' });
		})
	);
});
afterEach(() => vi.unstubAllGlobals());
afterAll(() => {
	db.close();
	rmSync(directory, { recursive: true, force: true });
});

describe('automatic upstream updates', () => {
	it('discovers existing imports, groups repository checks, and publishes only changed skills', async () => {
		const id = await seed();
		const other = await seed('other');
		updateOwners(id, owner, [owner.id, 'coowner']);
		const before = getSkill(id);
		const old = revisionFor(id);
		commit = newCommit;
		setFile('skills/demo/SKILL.md', content('demo').replace('Original', 'Updated instructions'));
		requests = [];
		expect(await sync()).toMatchObject({ updated: 1, unchanged: 1, failed: 0 });
		expect(requests.filter((url) => url.includes('/commits/'))).toHaveLength(1);
		expect(getSkill(id)).toMatchObject({
			revision: 2,
			source: { commit: newCommit },
			owners: before.owners,
			categories: before.categories,
			tags: before.tags,
			example: before.example,
			upstreamAuthor: before.upstreamAuthor
		});
		expect(getSkill(other).revision).toBe(1);
		expect(getSkill(other).source?.commit).toBe(oldCommit);
		expect(revisionFor(id, 1)).toEqual(old);
		expect(readPackageFile(revisionFor(id), 'SKILL.md').toString()).toContain(
			'Updated instructions'
		);
		expect(state(id)).toMatchObject({
			observed_commit: newCommit,
			checked_revision: 2,
			error: null
		});
		requests = [];
		expect(await sync()).toMatchObject({ updated: 0, unchanged: 2 });
		expect(requests.some((url) => url.includes('raw.githubusercontent.com'))).toBe(false);
	});

	it('ignores unrelated commits without changing attribution or downloading unchanged packages', async () => {
		const id = await seed();
		await sync();
		commit = newCommit;
		setFile('README.md', 'Unrelated change');
		requests = [];
		expect(await sync()).toMatchObject({ updated: 0, unchanged: 1 });
		expect(requests.some((url) => url.includes('raw.githubusercontent.com'))).toBe(false);
		expect(getSkill(id).source?.commit).toBe(oldCommit);
		expect(state(id).observed_commit).toBe(newCommit);
	});

	it.each(['companion', 'removal', 'mode', 'license'])(
		'updates a package after a %s change with unchanged SKILL.md',
		async (change) => {
			const id = await seed();
			await sync();
			commit = newCommit;
			if (change === 'companion') setFile('skills/demo/references/new.md', 'New reference');
			if (change === 'removal') delete files['skills/demo/scripts/run.py'];
			if (change === 'mode') files['skills/demo/scripts/run.py'].mode = '100644';
			if (change === 'license') setFile('LICENSE', 'Updated license');
			expect(await sync()).toMatchObject({ updated: 1, failed: 0 });
			expect(getSkill(id).source?.commit).toBe(newCommit);
			if (change === 'removal')
				expect(revisionFor(id).files.some((file) => file.path === 'scripts/run.py')).toBe(false);
		}
	);

	it.each(['missing', 'renamed', 'invalid', 'outage'])(
		'preserves the published revision after upstream becomes %s and retries later',
		async (failure) => {
			const id = await seed();
			commit = newCommit;
			if (failure === 'missing') delete files['skills/demo/SKILL.md'];
			if (failure === 'renamed') setFile('skills/demo/SKILL.md', content('different-name'));
			if (failure === 'invalid') setFile('skills/demo/SKILL.md', 'No frontmatter');
			if (failure === 'outage') status = 500;
			expect(await sync()).toMatchObject({ updated: 0, failed: 1 });
			expect(getSkill(id).revision).toBe(1);
			expect(getSkill(id).source?.commit).toBe(oldCommit);
			expect(state(id)).toMatchObject({ failures: 1, error: expect.any(String) });
			requests = [];
			expect(await sync()).toMatchObject({ deferred: 1 });
			expect(requests).toHaveLength(0);
			status = 200;
			setFile('skills/demo/SKILL.md', content('demo') + '\nRecovered');
			db.prepare('UPDATE upstream_sync SET next_check_at=0').run();
			expect(await sync()).toMatchObject({ updated: 1, failed: 0 });
			expect(state(id)).toMatchObject({ failures: 0, error: null, next_check_at: 0 });
		}
	);

	it('backs off all remaining checks on a GitHub rate limit', async () => {
		const id = await seed();
		await seed('other');
		status = 429;
		requests = [];
		const start = Date.now();
		expect(await sync()).toMatchObject({ failed: 2, updated: 0 });
		expect(requests).toHaveLength(1);
		expect(Number(state(id).next_check_at)).toBeGreaterThanOrEqual(start + 7200000);
	});

	it('does not overwrite a simultaneous catalog edit and recovers on the next attempt', async () => {
		const id = await seed();
		const pkg = validatePackage([
			{ path: 'SKILL.md', data: Buffer.from(content('demo')), mode: 0o644 }
		]);
		pkg.source = getSkill(id).source!;
		commit = newCommit;
		setFile('skills/demo/SKILL.md', content('demo') + '\nChanged');
		duringDownload = () => publish(owner, pkg, { ...meta, tags: ['edited'] }, { id, expected: 1 });
		expect(await sync()).toMatchObject({ failed: 1, updated: 0 });
		expect(getSkill(id)).toMatchObject({ revision: 2, tags: ['edited'] });
		db.prepare('UPDATE upstream_sync SET next_check_at=0').run();
		expect(await sync()).toMatchObject({ updated: 1 });
		expect(getSkill(id)).toMatchObject({ revision: 3, tags: ['edited'] });
	});

	it('excludes archived and local entries and honors the cross-process lease', async () => {
		const id = await seed();
		db.prepare('UPDATE skills SET archived=1 WHERE id=?').run(id);
		publish(
			owner,
			validatePackage([{ path: 'SKILL.md', data: Buffer.from(content('local')), mode: 0o644 }]),
			meta
		);
		requests = [];
		expect(await sync()).toMatchObject({ unchanged: 0, updated: 0 });
		expect(requests).toHaveLength(0);
		db.prepare('UPDATE skills SET archived=0 WHERE id=?').run(id);
		db.prepare('INSERT INTO upstream_sync_lock VALUES (1, ?, ?)').run(
			'another-worker',
			Date.now() + 60000
		);
		expect(await sync()).toMatchObject({ locked: true });
		expect(requests).toHaveLength(0);
		db.prepare('UPDATE upstream_sync_lock SET expires_at=0').run();
		expect(await sync()).toMatchObject({ locked: false, unchanged: 1 });
	});
});
