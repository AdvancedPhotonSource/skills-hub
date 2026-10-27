import { db } from '../src/lib/server/db';
import { userById } from '../src/lib/server/auth';
import { classification, getSkill, publish, revisionFor } from '../src/lib/server/catalog';
import { inspectRepository, importDirectory } from '../src/lib/server/github';
import { validatePackage, sha256 } from '../src/lib/server/packages';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { starterCatalog, localSkills, catalogMetadata, type CatalogSkill } from './catalog';

function metadata(entry: CatalogSkill, repository?: string) {
	const form = new FormData();
	entry.categories.forEach((category) => form.append('category', category));
	form.set('tags', entry.tags.join(','));
	form.set('role', entry.role);
	form.set('example', entry.example || '');
	return { ...classification(form), ...catalogMetadata(entry, repository) };
}

const args = process.argv.slice(2);
if (args.some((arg) => arg !== '--local-only'))
	throw new Error('Usage: npm run import:catalog -- [--local-only]');

try {
	const account = db.prepare('SELECT id FROM users WHERE default_maintainer=1').get() as
		{ id: string } | undefined;
	const owner = account ? userById(account.id) : null;
	if (!owner?.verified) throw new Error('Run npm run curate -- <maintainer username> first.');
	for (const source of args.includes('--local-only') ? [] : starterCatalog) {
		let snapshot;
		for (const entry of source.skills) {
			const row = db
				.prepare(
					"SELECT id FROM skills WHERE (owner_id=? OR owner_id='aps-curated-library') AND name=?"
				)
				.get(owner.id, entry.name) as { id: string } | undefined;
			const existing = row ? getSkill(row.id, owner) : null;
			const directory = entry.directory || `skills/${entry.name}`;
			if (
				existing &&
				(existing.source?.repository !== source.repository ||
					existing.source.directory !== directory)
			)
				throw new Error(`Conflicting source for ${entry.name}; inspect it before proceeding.`);
			const meta = metadata(entry, source.repository);
			if (
				existing?.source?.commit === source.commit &&
				JSON.stringify(existing.categories) === JSON.stringify(meta.categories) &&
				JSON.stringify(existing.tags) === JSON.stringify(meta.tags) &&
				existing.role === meta.role &&
				existing.example === meta.example &&
				Object.entries(catalogMetadata(entry, source.repository)).every(
					([key, value]) =>
						['name', 'directory'].includes(key) ||
						JSON.stringify(existing[key as keyof typeof existing]) === JSON.stringify(value)
				)
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
			.prepare(
				"SELECT id FROM skills WHERE (owner_id=? OR owner_id='aps-curated-library') AND name=?"
			)
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
			existing.example === meta.example &&
			Object.entries(catalogMetadata(entry)).every(
				([key, value]) =>
					['name', 'directory'].includes(key) ||
					JSON.stringify(existing[key as keyof typeof existing]) === JSON.stringify(value)
			)
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
} finally {
	db.close();
}
