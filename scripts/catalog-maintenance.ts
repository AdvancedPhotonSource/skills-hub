import { db } from '../src/lib/server/db';
import {
	deleteEntry,
	getSkill,
	publish,
	readPackageFile,
	revisionFor
} from '../src/lib/server/catalog';
import { canonicalContext } from '../src/lib/contexts';
import type { Skill, User } from '../src/lib/types';
import { catalogOwner, assignCatalogOwner } from './catalog-owner';
import { catalogOwnership } from './catalog-owners';

const removedOrganizations = new Set(['k-dense-ai', 'uw-ssec']);
function organization(url: string) {
	try {
		const parsed = new URL(url);
		return ['github.com', 'www.github.com', 'raw.githubusercontent.com'].includes(parsed.hostname)
			? parsed.pathname.split('/')[1].toLowerCase()
			: '';
	} catch {
		return '';
	}
}

export function removeFromCatalog(skill: Skill) {
	if (['hpc-orchestration', 'create-eaa-compatible-mcp-servers'].includes(skill.name)) return true;
	return [
		skill.source?.repository.split('/')[0].toLowerCase(),
		organization(skill.sourceUrl),
		organization(skill.mcp?.repository || ''),
		skill.upstreamAuthor.trim().toLowerCase()
	].some((author) => author && removedOrganizations.has(author));
}

export function refineCatalog(admin: User, log: (message: string) => void = console.log) {
	if (!admin.isAdmin) throw new Error('Catalog cleanup requires a Hub administrator.');
	const entries = db.prepare('SELECT id FROM skills ORDER BY name').all() as { id: string }[];
	const sharedOwner = db
		.prepare('SELECT id, display_name FROM users WHERE default_maintainer=1')
		.get() as { id: string; display_name: string } | undefined;
	if (!sharedOwner && db.prepare("SELECT 1 FROM skills WHERE owner_id='aps-curated-library'").get())
		throw new Error('Configure the default maintainer before transferring shared-library entries.');
	const counts = { removed: 0, reassigned: 0, revised: 0, unresolved: 0 };
	for (const { id } of entries) {
		const skill = getSkill(id, admin);
		if (removeFromCatalog(skill)) {
			deleteEntry(id, admin, skill.revision);
			log(`Removed ${skill.applicationType}: ${skill.name}`);
			counts.removed++;
			continue;
		}
		const ownership = skill.source
			? catalogOwnership(skill.source.repository, skill.source.directory)
			: null;
		const contexts = [...new Set(skill.contexts.map((value) => canonicalContext(value) || value))];
		const unknown = contexts.filter((value) => !canonicalContext(value));
		const upstreamAuthor = ownership?.attribution || skill.upstreamAuthor;
		if (unknown.length) {
			log(`Needs context review: ${skill.name}: ${unknown.join(', ')}`);
			counts.unresolved++;
		} else if (
			JSON.stringify(contexts) !== JSON.stringify(skill.contexts) ||
			upstreamAuthor !== skill.upstreamAuthor
		) {
			const revision = revisionFor(id);
			const files = revision.files.map((file) => ({
				path: file.path,
				mode: file.mode || 0o644,
				data: readPackageFile(revision, file.path)
			}));
			publish(
				admin,
				{
					name: skill.name,
					description: skill.description,
					license: skill.license,
					compatibility: skill.compatibility,
					version: revision.version,
					content:
						files
							.find(
								(file) => file.path === (skill.applicationType === 'mcp' ? 'README.md' : 'SKILL.md')
							)
							?.data.toString('utf8') || '',
					files,
					source: skill.source || undefined,
					projectRepository: null
				},
				{ ...skill, contexts, upstreamAuthor },
				{ id, expected: skill.revision }
			);
			counts.revised++;
		}
		if (ownership) {
			const ownerId = catalogOwner(ownership.login);
			if (skill.ownerId !== ownerId) {
				assignCatalogOwner(id, ownerId);
				counts.reassigned++;
				log(`Owner: ${skill.name} → ${ownership.name} (${ownership.basis})`);
			}
		} else if (skill.ownerId === 'aps-curated-library') {
			assignCatalogOwner(id, sharedOwner!.id, true);
			counts.reassigned++;
			log(`Owner and maintainer: ${skill.name} → ${sharedOwner!.display_name}`);
		}
	}
	return counts;
}
