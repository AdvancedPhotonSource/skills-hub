import { db } from '../src/lib/server/db';
import { userById } from '../src/lib/server/auth';
import { deleteEntry, publish, revisionFor, readPackageFile } from '../src/lib/server/catalog';
import { emptyDetails, validateDetails } from '../src/lib/server/details';
import { validatePackage } from '../src/lib/server/packages';
import { catalogMetadata, localSkills, starterCatalog } from './catalog';
import { readFileSync } from 'node:fs';

// One-time catalog cleanup; scoped to the former shared libraries, never personal submissions.
const removed = new Set([
	'browser-use',
	'deployment-patterns',
	'docker-patterns',
	'frontend-design',
	'webapp-testing',
	'mcp-builder',
	'skill-creator',
	'sympy',
	'polars',
	'vaex',
	'shap',
	'exploratory-data-analysis',
	'scientific-visualization',
	'statistical-analysis',
	'matplotlib',
	'uncertainty-and-units'
]);

try {
	const username = process.argv[2];
	if (!username) throw new Error('Usage: npm run curate -- <Samuel Haskel account username>');
	const account = db.prepare('SELECT id FROM users WHERE username=?').get(username) as
		{ id: string } | undefined;
	if (!account) throw new Error('Create the maintainer account first.');
	db.transaction(() => {
		db.prepare('UPDATE users SET default_maintainer=0 WHERE default_maintainer=1').run();
		db.prepare(
			"UPDATE users SET display_name='Samuel Haskel', verified=1, is_admin=1, default_maintainer=1 WHERE id=?"
		).run(account.id);
		db.prepare('UPDATE skills SET maintainer_id=?').run(account.id);
	})();
	const maintainer = userById(account.id)!;
	const definitions = new Map([
		...localSkills.map((entry) => [entry.name, catalogMetadata(entry)] as const),
		...starterCatalog.flatMap((source) =>
			source.skills.map((entry) => [entry.name, catalogMetadata(entry, source.repository)] as const)
		)
	]);
	const entries = db.prepare('SELECT id, name, owner_id, revision, details FROM skills').all() as {
		id: string;
		name: string;
		owner_id: string;
		revision: number;
		details: string;
	}[];
	for (const entry of entries) {
		if (
			entry.owner_id === 'aps-example-library' ||
			(entry.owner_id === 'aps-curated-library' && removed.has(entry.name))
		) {
			deleteEntry(entry.id, maintainer, entry.revision);
			console.log(`Deleted ${entry.name}`);
			continue;
		}
		if (entry.details !== '{}') continue;
		const current = revisionFor(entry.id);
		const meta = definitions.get(entry.name);
		const details = validateDetails(
			meta || {
				...emptyDetails,
				provenance:
					current.source && !current.source.repository.startsWith('AdvancedPhotonSource/')
						? 'external'
						: 'argonne',
				sourceUrl: current.source ? `https://github.com/${current.source.repository}` : '',
				upstreamAuthor: current.source?.author || ''
			}
		);
		db.transaction(() => {
			db.prepare('UPDATE skills SET details=? WHERE id=?').run(JSON.stringify(details), entry.id);
			db.prepare("UPDATE revisions SET details=? WHERE skill_id=? AND details='{}'").run(
				JSON.stringify(details),
				entry.id
			);
			const row = db.prepare('SELECT tags FROM skills WHERE id=?').get(entry.id) as {
				tags: string;
			};
			const tags = (JSON.parse(row.tags) as string[]).filter((t) => !['skill', 'mcp'].includes(t));
			db.prepare('UPDATE skills SET tags=? WHERE id=?').run(JSON.stringify(tags), entry.id);
			db.prepare('UPDATE skill_search SET tags=? WHERE skill_id=?').run(
				[...tags, ...details.contexts, ...details.techniques, details.applicationType].join(' '),
				entry.id
			);
		})();
		console.log(`Classified ${entry.name}: ${details.applicationType}`);
	}
	const discovery = localSkills.find((entry) => entry.name === 'aps-hub-discovery')!;
	const file = readFileSync(new URL('../skills/aps-hub-discovery/SKILL.md', import.meta.url));
	const existing = db
		.prepare('SELECT id, revision FROM skills WHERE name=? AND maintainer_id=?')
		.get(discovery.name, maintainer.id) as { id: string; revision: number } | undefined;
	if (!existing || !readPackageFile(revisionFor(existing.id), 'SKILL.md').equals(file)) {
		publish(
			maintainer,
			validatePackage([{ path: 'SKILL.md', data: file, mode: 0o644 }]),
			catalogMetadata(discovery),
			existing ? { id: existing.id, expected: existing.revision } : undefined
		);
		console.log('Published aps-hub-discovery');
	}
	console.log('Maintained by Samuel Haskel.');
} finally {
	db.close();
}
