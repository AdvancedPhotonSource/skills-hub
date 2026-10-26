import { db } from '../src/lib/server/db';
import { userById } from '../src/lib/server/auth';
import {
	classification,
	getSkill,
	publish,
	revisionFor,
	setArchived
} from '../src/lib/server/catalog';
import { inspectRepository, importDirectory } from '../src/lib/server/github';
import { validatePackage, sha256 } from '../src/lib/server/packages';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { starterCatalog, localSkills, type CatalogSkill } from './catalog';

function metadata(entry: CatalogSkill) {
	const form = new FormData();
	entry.categories.forEach((category) => form.append('category', category));
	form.set('tags', entry.tags.join(','));
	form.set('role', entry.role);
	form.set('example', entry.example || '');
	return classification(form);
}

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
			const directory = entry.directory || `skills/${entry.name}`;
			if (
				existing &&
				(existing.source?.repository !== source.repository ||
					existing.source.directory !== directory)
			)
				throw new Error(`Conflicting source for ${entry.name}; inspect it before proceeding.`);
			const meta = metadata(entry);
			if (
				existing?.source?.commit === source.commit &&
				JSON.stringify(existing.categories) === JSON.stringify(meta.categories) &&
				JSON.stringify(existing.tags) === JSON.stringify(meta.tags) &&
				existing.role === meta.role &&
				existing.example === meta.example
			) {
				console.log(`Already imported: ${entry.name}`);
				continue;
			}
			snapshot ??= await inspectRepository(
				`https://github.com/${source.repository}`,
				source.commit
			);
			const pkg = await importDirectory(snapshot, directory, source.ref);
			if (pkg.name !== entry.name) throw new Error(`Unexpected upstream skill name: ${entry.name}`);
			const skillId = publish(
				owner,
				pkg,
				meta,
				existing ? { id: existing.id, expected: existing.revision } : undefined
			);
			console.log(`Imported ${entry.name}: ${pkg.files.length} files → /skills/${skillId}`);
		}
	}
	for (const entry of localSkills) {
		const folder = fileURLToPath(new URL(`../skills/${entry.name}/`, import.meta.url));
		const files = readdirSync(folder, { recursive: true, withFileTypes: true })
			.filter((file) => !file.isDirectory())
			.map((file) => {
				if (!file.isFile()) throw new Error(`Unsupported local package entry: ${file.name}`);
				const path = join(file.parentPath, file.name);
				return {
					path: relative(folder, path).split(sep).join('/'),
					data: readFileSync(path),
					mode: statSync(path).mode & 0o111 ? 0o755 : 0o644
				};
			});
		const pkg = validatePackage(files);
		if (pkg.name !== entry.name) throw new Error(`Unexpected local skill name: ${entry.name}`);
		const row = db
			.prepare('SELECT id FROM skills WHERE owner_id=? AND name=?')
			.get(owner.id, entry.name) as { id: string } | undefined;
		const existing = row ? getSkill(row.id, owner) : null;
		if (existing?.source)
			throw new Error(`Cannot replace an upstream import with local files: ${entry.name}`);
		const meta = metadata(entry);
		const checksum = sha256(
			JSON.stringify(
				pkg.files.map((file) => ({
					path: file.path,
					size: file.data.length,
					sha256: sha256(file.data),
					mode: file.mode
				}))
			)
		);
		if (
			existing &&
			revisionFor(existing.id).checksum === checksum &&
			JSON.stringify(existing.categories) === JSON.stringify(meta.categories) &&
			JSON.stringify(existing.tags) === JSON.stringify(meta.tags) &&
			existing.role === meta.role &&
			existing.example === meta.example
		) {
			console.log(`Already published: ${entry.name}`);
			continue;
		}
		const skillId = publish(
			owner,
			pkg,
			meta,
			existing ? { id: existing.id, expected: existing.revision } : undefined
		);
		console.log(`Published ${entry.name}: ${pkg.files.length} files → /skills/${skillId}`);
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
