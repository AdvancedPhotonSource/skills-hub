import { db } from '../src/lib/server/db';
import { userById } from '../src/lib/server/auth';
import {
	classification,
	getSkill,
	publish,
	readPackageFile,
	revisionFor,
	updateOwners
} from '../src/lib/server/catalog';
import { inspectRepository, importDirectory } from '../src/lib/server/github';
import { validatePackage, sha256 } from '../src/lib/server/packages';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
	starterCatalog,
	localSkills,
	catalogMetadata,
	hiddenCatalogSkills,
	type CatalogSkill
} from './catalog';
import { catalogOwnership } from './catalog-owners';
import { catalogOwner, assignCatalogOwner, localCatalogOwners } from './catalog-owner';
import { parseArgs } from 'node:util';

function metadata(entry: CatalogSkill, repository?: string) {
	const form = new FormData();
	entry.categories.forEach((category) => form.append('category', category));
	form.set('tags', entry.tags.join(','));
	form.set('role', entry.role);
	form.set('example', entry.example || '');
	return { ...classification(form), ...catalogMetadata(entry, repository) };
}

const { values: args } = parseArgs({
	options: { 'local-only': { type: 'boolean' }, skill: { type: 'string' } }
});

try {
	if (
		args.skill &&
		![...localSkills, ...starterCatalog.flatMap((source) => source.skills)].some(
			(entry) => entry.name === args.skill
		)
	)
		throw new Error(`Unknown catalog skill: ${args.skill}`);
	const account = db.prepare('SELECT id FROM users WHERE default_maintainer=1').get() as
		{ id: string } | undefined;
	const owner = account ? userById(account.id) : null;
	if (!owner) throw new Error('Run npm run curate -- <maintainer username> first.');
	for (const source of args['local-only'] ? [] : starterCatalog) {
		let snapshot;
		for (const entry of source.skills.filter((entry) => !args.skill || entry.name === args.skill)) {
			const directory = entry.directory || `skills/${entry.name}`;
			const ownership = catalogOwnership(source.repository, directory);
			const ownerId = ownership ? catalogOwner(ownership.login) : owner.id;
			const rows = db
				.prepare(
					"SELECT id, owner_id FROM skills WHERE (owner_id=? OR owner_id=? OR maintainer_id=? OR owner_id='aps-curated-library') AND name=?"
				)
				.all(owner.id, ownerId, owner.id, entry.name) as { id: string; owner_id: string }[];
			if (rows.length > 1)
				throw new Error(`Multiple catalog entries named ${entry.name}; inspect before importing.`);
			const row = rows[0];
			const publisher = row ? userById(row.owner_id)! : owner;
			const existing = row ? getSkill(row.id, publisher) : null;
			if (
				existing &&
				(existing.source?.repository !== source.repository ||
					existing.source.directory !== directory)
			)
				throw new Error(`Conflicting source for ${entry.name}; inspect it before proceeding.`);
			const meta = metadata(entry, source.repository);
			if (
				existing &&
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
				if (ownership) assignCatalogOwner(existing.id, ownerId);
				console.log(`Already imported: ${entry.name}`);
				continue;
			}
			// Starter pins bootstrap new entries only. Existing imports follow their upstream
			// ref; catalog maintenance must never roll their files back to the starter pin.
			let pkg;
			if (existing) {
				const revision = revisionFor(existing.id);
				pkg = validatePackage(
					revision.files.map((file) => ({
						path: file.path,
						data: readPackageFile(revision, file.path),
						mode: file.mode || 0o644
					}))
				);
				pkg.source = existing.source!;
			} else {
				snapshot ??= await inspectRepository(
					`https://github.com/${source.repository}`,
					source.commit
				);
				pkg = await importDirectory(snapshot, directory, source.ref);
			}
			if (pkg.name !== entry.name) throw new Error(`Unexpected upstream skill name: ${entry.name}`);
			const skillId = publish(
				publisher,
				pkg,
				meta,
				existing ? { id: existing.id, expected: existing.revision } : undefined
			);
			if (ownership) assignCatalogOwner(skillId, ownerId);
			console.log(`Imported ${entry.name}: ${pkg.files.length} files → /skills/${skillId}`);
		}
	}
	for (const entry of localSkills.filter((entry) => !args.skill || entry.name === args.skill)) {
		if (hiddenCatalogSkills.has(entry.name)) {
			console.log(`Hidden; import skipped: ${entry.name}`);
			continue;
		}
		const ownerIds = localCatalogOwners(entry.name);
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
		const rows = db
			.prepare(
				"SELECT id, owner_id FROM skills WHERE (owner_id=? OR owner_id=? OR maintainer_id=? OR owner_id='aps-curated-library') AND name=?"
			)
			.all(owner.id, ownerIds?.[0] || owner.id, owner.id, entry.name) as {
			id: string;
			owner_id: string;
		}[];
		if (rows.length > 1)
			throw new Error(`Multiple catalog entries named ${entry.name}; inspect before importing.`);
		const row = rows[0];
		const publisher = row ? userById(row.owner_id)! : owner;
		const existing = row ? getSkill(row.id, publisher) : null;
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
			if (ownerIds) updateOwners(existing.id, publisher, ownerIds);
			console.log(`Already published: ${entry.name}`);
			continue;
		}
		const skillId = publish(
			publisher,
			pkg,
			meta,
			existing ? { id: existing.id, expected: existing.revision } : undefined
		);
		if (ownerIds) updateOwners(skillId, publisher, ownerIds);
		console.log(`Published ${entry.name}: ${pkg.files.length} files → /skills/${skillId}`);
	}
} finally {
	db.close();
}
