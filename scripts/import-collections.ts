import { db } from '../src/lib/server/db';
import { userById } from '../src/lib/server/auth';
import { getSkill, publish, updateOwners, type Classification } from '../src/lib/server/catalog';
import { inspectRepository, importDirectory } from '../src/lib/server/github';
import { mcpPackage } from '../src/lib/server/packages';
import { catalogOwner } from './catalog-owner';

// Re-runnable on a local preview or the deployed data directory. Match upstream
// identity across every owner before importing; never replace existing packages.
const collections = [
	{
		name: 'ptychodus-collection',
		title: 'Ptychodus collection',
		repository: 'AdvancedPhotonSource/ptychodus',
		directory: '.claude/skills',
		owner: 'stevehenke',
		description:
			'Build and maintain Ptychodus: plugins, reconstruction backends, application architecture, web development, and release workflows.',
		categories: ['imaging', 'python'],
		tags: ['ptychodus', 'ptychography', 'python'],
		role: 'Software engineer'
	},
	{
		name: 'apexa-collection',
		title: 'APEXA collection',
		repository: 'AdvancedPhotonSource/APEXA-APS-Beamline-Assistant',
		directory: '.agents/skills',
		owner: 'pawantr',
		description:
			'Beamline workflows for APEXA: experiment control, MIDAS diffraction analysis, GSAS-II refinement, tomography, and reporting.',
		categories: ['acquisition', 'reduction'],
		tags: ['apexa', 'midas', 'epics'],
		role: 'Beamline scientist'
	}
] as const;

try {
	for (const collection of collections) {
		const owner = userById(catalogOwner(collection.owner))!;
		const snapshot = await inspectRepository(`https://github.com/${collection.repository}`, 'main');
		const directories = snapshot.directories.filter((directory) =>
			directory.startsWith(`${collection.directory}/`)
		);
		if (!directories.length) throw new Error(`No skills found for ${collection.title}`);
		const memberIds: string[] = [];
		let imported = 0;
		for (const directory of directories) {
			const matches = db
				.prepare(
					`SELECT s.id FROM skills s JOIN revisions r ON r.skill_id=s.id AND r.number=s.revision
				WHERE json_extract(r.source, '$.repository')=? COLLATE NOCASE AND json_extract(r.source, '$.directory')=?`
				)
				.all(collection.repository, directory) as { id: string }[];
			if (matches.length > 1)
				throw new Error(`Duplicate upstream entries for ${directory}; inspect before importing.`);
			let id = matches[0]?.id;
			if (!id) {
				const pkg = await importDirectory(snapshot, directory, 'main');
				if (db.prepare('SELECT 1 FROM skills WHERE name=? COLLATE NOCASE').get(pkg.name))
					throw new Error(
						`An entry named ${pkg.name} already exists with a different source; inspect before importing.`
					);
				const meta: Classification = {
					categories: [...collection.categories],
					tags: [...collection.tags],
					role: collection.role,
					contexts: ['aps'],
					provenance: 'argonne',
					upstreamAuthor: owner.displayName
				};
				if (collection.owner === 'pawantr') {
					meta.categories =
						pkg.name === 'motor-control'
							? ['controls']
							: pkg.name === 'apexa-report'
								? ['reporting', 'acquisition']
								: pkg.name === 'tomo-reconstruct'
									? ['imaging']
									: ['reduction'];
				} else if (/^(check|pre-|curate)/.test(pkg.name)) meta.categories = ['testing', 'python'];
				id = publish(owner, pkg, meta);
				imported++;
				console.log(`Imported ${pkg.name}: ${pkg.files.length} files`);
			} else console.log(`Reused ${directory}`);
			const entry = getSkill(id, owner);
			const owners = [
				owner.id,
				...entry.owners
					.map((user) => user.id)
					.filter((id) => id !== entry.ownerId && id !== owner.id)
			];
			if (directory === '.agents/skills/gsas2-agentic') owners.push(catalogOwner('brian-toby'));
			updateOwners(id, userById(entry.ownerId)!, owners);
			memberIds.push(id);
		}
		const existingRow = db
			.prepare('SELECT id FROM skills WHERE owner_id=? AND name=?')
			.get(owner.id, collection.name) as { id: string } | undefined;
		const existing = existingRow ? getSkill(existingRow.id, owner) : null;
		if (existing && existing.applicationType !== 'collection')
			throw new Error(`Conflicting entry: ${collection.name}`);
		let id = existing?.id;
		if (!existing || JSON.stringify(existing.collectionMembers) !== JSON.stringify(memberIds)) {
			id = publish(
				owner,
				mcpPackage(
					collection.name,
					collection.description,
					'Browse the individual skills for instructions and source files.'
				),
				{
					applicationType: 'collection',
					collectionTitle: collection.title,
					collectionMembers: memberIds,
					categories: [...collection.categories],
					tags: [...collection.tags],
					role: collection.role,
					contexts: ['aps'],
					provenance: 'argonne',
					sourceUrl: `https://github.com/${collection.repository}`,
					upstreamAuthor: owner.displayName
				},
				existing ? { id: existing.id, expected: existing.revision } : undefined
			);
		}
		console.log(
			`${collection.title}: ${imported} new, ${memberIds.length - imported} reused, ${memberIds.length} total → /skills/${id}`
		);
	}
} finally {
	db.close();
}
