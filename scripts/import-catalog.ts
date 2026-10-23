import { db } from '../src/lib/server/db';
import { userById } from '../src/lib/server/auth';
import { classification, getSkill, publish, setArchived } from '../src/lib/server/catalog';
import { inspectRepository, importDirectory } from '../src/lib/server/github';
import { starterCatalog } from './catalog';

const args = process.argv.slice(2);
if (args.some((arg) => arg !== '--archive-examples'))
	throw new Error('Usage: npm run import:catalog -- [--archive-examples]');

try {
	const id = 'aps-curated-library';
	db.prepare('INSERT OR IGNORE INTO users (id, username, display_name) VALUES (?, ?, ?)').run(
		id,
		'curated',
		'APS curated library'
	);
	const owner = userById(id);
	if (!owner) throw new Error('The curated username is already in use. No account was changed.');
	for (const source of starterCatalog) {
		let snapshot;
		for (const entry of source.skills) {
			const row = db
				.prepare('SELECT id FROM skills WHERE owner_id=? AND name=?')
				.get(owner.id, entry.name) as { id: string } | undefined;
			const existing = row ? getSkill(row.id, owner) : null;
			const directory = `skills/${entry.name}`;
			if (
				existing &&
				(existing.source?.repository !== source.repository ||
					existing.source.directory !== directory)
			)
				throw new Error(`Conflicting source for ${entry.name}; inspect it before proceeding.`);
			if (existing?.source?.commit === source.commit) {
				console.log(`Already imported: ${entry.name}`);
				continue;
			}
			snapshot ??= await inspectRepository(
				`https://github.com/${source.repository}`,
				source.commit
			);
			const pkg = await importDirectory(snapshot, directory, source.ref);
			if (pkg.name !== entry.name || !pkg.source?.licenses.length)
				throw new Error(`Missing expected name or license notices: ${entry.name}`);
			const form = new FormData();
			entry.categories.forEach((category) => form.append('category', category));
			form.set('tags', entry.tags.join(','));
			form.set('role', entry.role);
			form.set('example', entry.example);
			const skillId = publish(
				owner,
				pkg,
				classification(form),
				existing ? { id: existing.id, expected: existing.revision } : undefined
			);
			console.log(`Imported ${entry.name}: ${pkg.files.length} files → /skills/${skillId}`);
		}
	}
	if (args.includes('--archive-examples')) {
		const examples = userById('aps-example-library');
		if (examples) {
			const rows = db
				.prepare('SELECT id, revision FROM skills WHERE owner_id=? AND archived=0')
				.all(examples.id) as { id: string; revision: number }[];
			for (const row of rows) setArchived(row.id, examples, true, row.revision);
			console.log(`Archived ${rows.length} demo entries.`);
		}
	}
} finally {
	db.close();
}
