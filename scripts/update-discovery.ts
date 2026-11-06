import { readFileSync } from 'node:fs';
import { db } from '../src/lib/server/db';
import { userById } from '../src/lib/server/auth';
import { getSkill, publish, readPackageFile, revisionFor } from '../src/lib/server/catalog';
import { validatePackage } from '../src/lib/server/packages';

// Publish only the existing discovery entry, preserving ownership and metadata.
try {
	const username = process.argv[2];
	if (!username) throw new Error('Usage: tsx scripts/update-discovery.ts <maintainer username>');
	const rows = db
		.prepare(
			`SELECT s.id, s.maintainer_id FROM skills s JOIN users u ON u.id=s.maintainer_id
			 WHERE s.name='aps-hub-discovery' AND u.username=?`
		)
		.all(username) as { id: string; maintainer_id: string }[];
	if (rows.length !== 1) throw new Error('Expected exactly one existing discovery entry.');
	const user = userById(rows[0].maintainer_id);
	if (!user) throw new Error('Maintainer account not found.');
	const skill = getSkill(rows[0].id, user);
	const revision = revisionFor(skill.id);
	const source = readFileSync(new URL('../skills/aps-hub-discovery/SKILL.md', import.meta.url));
	if (readPackageFile(revision, 'SKILL.md').equals(source)) {
		console.log('Discovery package is already current.');
	} else {
		const pkg = validatePackage(
			revision.files.map((file) => ({
				path: file.path,
				data: file.path === 'SKILL.md' ? source : readPackageFile(revision, file.path),
				mode: (file as typeof file & { mode?: number }).mode || 0o644
			}))
		);
		pkg.source = revision.source || undefined;
		publish(user, pkg, skill, { id: skill.id, expected: skill.revision });
		console.log(`Published ${skill.name} revision ${skill.revision + 1} (${skill.id}).`);
	}
} finally {
	db.close();
}
