import { afterAll, describe, expect, it } from 'vitest';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';

const directory = mkdtempSync(join(tmpdir(), 'aps-catalog-maintenance-'));
process.env.DATA_DIR = directory;
const { db } = await import('../src/lib/server/db');
const { userById } = await import('../src/lib/server/auth');
const { publish, getSkill, revisionFor, readPackageFile, searchSkills, requireOwner } =
	await import('../src/lib/server/catalog');
const { validatePackage, mcpPackage } = await import('../src/lib/server/packages');
const { refineCatalog } = await import('../scripts/catalog-maintenance');
const { catalogOwner } = await import('../scripts/catalog-owner');
const { starterCatalog, catalogMetadata } = await import('../scripts/catalog');
const { genesisRepository } = await import('../scripts/genesis-owners');
const { detailsFromForm } = await import('../src/lib/server/details');

db.prepare(
	"INSERT INTO users (id, username, display_name, is_admin, default_maintainer) VALUES ('admin', 'admin', 'Administrator', 1, 1), ('other', 'other', 'Other', 0, 0)"
).run();
const admin = userById('admin')!;
const other = userById('other')!;
const meta = { categories: ['hpc'], tags: ['python'], role: '', relevance: 'APS analysis' };
function skill(name: string, repository?: string, path = `skills/${name}`, owner = admin) {
	const pkg = validatePackage([
		{
			path: 'SKILL.md',
			mode: 0o644,
			data: Buffer.from(`---\nname: ${name}\ndescription: APS workflow\n---\nInstructions.\n`)
		},
		{ path: 'scripts/run.sh', mode: 0o755, data: Buffer.from('#!/bin/sh\nexit 0\n') }
	]);
	if (repository)
		pkg.source = {
			repository,
			directory: path,
			ref: 'main',
			commit: 'a'.repeat(40),
			commitDate: '2026-10-30T00:00:00Z',
			author: repository.split('/')[0],
			licenses: []
		};
	return publish(owner, pkg, meta);
}
afterAll(() => {
	db.close();
	rmSync(directory, { recursive: true, force: true });
});

describe('catalog refinement', () => {
	it('removes retired catalog entries and organization imports without deleting unrelated skills', () => {
		const removed = [
			skill('pytorch-lightning', 'K-Dense-AI/scientific-agent-skills'),
			skill('containers', 'uw-ssec/rse-plugins'),
			skill('hpc-orchestration', 'scimate-ai/hpc-skills'),
			skill('create-eaa-compatible-mcp-servers', 'AdvancedPhotonSource/EAA'),
			skill('aps-eaa-workflow-setup'),
			skill('aps-lauelab-indexing'),
			...[
				'agentic-vulnerabilities-scan',
				'ai-fingerprint',
				'battleprint',
				'fingerprinting',
				'uncertainty-quantification',
				'uq-metrics-evaluator'
			].map((name) => skill(name, genesisRepository, `skills/basesafe-skills/${name}`))
		];
		removed.push(
			publish(admin, mcpPackage('external-mcp', 'External tools', 'Run it.'), {
				...meta,
				applicationType: 'mcp',
				sourceUrl: 'https://github.com/UW-SSEC/tools',
				mcp: {
					repository: 'https://github.com/UW-SSEC/tools',
					documentation: '',
					deployment: 'self-hosted',
					access: 'internal',
					transport: 'stdio',
					endpoint: '',
					authentication: '',
					configuration: '',
					instructions: 'Run it.',
					tools: ''
				}
			})
		);
		const kept = [
			skill('osa-alignment'),
			skill('pytorch-lightning', undefined, undefined, other),
			skill('fingerprinting', undefined, undefined, other)
		];
		const revisions = removed.map((id) => revisionFor(id));
		expect(() => refineCatalog(other)).toThrow('administrator');
		expect(refineCatalog(admin, () => {}).removed).toBe(13);
		for (const id of removed) {
			expect(() => getSkill(id)).toThrow('not found');
			expect(db.prepare('SELECT 1 FROM revisions WHERE skill_id=?').get(id)).toBeUndefined();
			expect(db.prepare('SELECT 1 FROM skill_search WHERE skill_id=?').get(id)).toBeUndefined();
		}
		for (const revision of revisions)
			expect(existsSync(join(directory, 'packages', revision.id))).toBe(false);
		for (const id of kept) expect(getSkill(id).id).toBe(id);
		expect(
			starterCatalog.some((source) => /^(K-Dense-AI|uw-ssec)\//i.test(source.repository))
		).toBe(false);
		expect(
			starterCatalog
				.flatMap((source) => source.skills)
				.some((entry) =>
					['hpc-orchestration', 'create-eaa-compatible-mcp-servers'].includes(entry.name)
				)
		).toBe(false);
	});
	it('assigns each Genesis entry to its credited author or uploader, preserving files and history', () => {
		const genesis = starterCatalog.find((source) => source.repository === genesisRepository)!;
		const ids = genesis.skills.map((entry) =>
			skill(entry.name, genesisRepository, entry.directory || `skills/${entry.name}`)
		);
		const before = ids.map((id) => revisionFor(id));
		const result = refineCatalog(admin, () => {});
		expect(result).toMatchObject({ reassigned: 6, revised: 6, unresolved: 0 });
		ids.forEach((id, index) => {
			const current = getSkill(id);
			const entry = genesis.skills[index];
			expect(current.displayName).toBe(entry.name === 'academy' ? 'Ian Foster' : 'Matt Baughman');
			expect(current.upstreamAuthor).toBe(catalogMetadata(entry, genesisRepository).upstreamAuthor);
			expect(current.maintainerId).toBe(admin.id);
			expect(() => requireOwner(id, admin)).toThrow('Only the owner');
			expect(requireOwner(id, userById(current.ownerId)).id).toBe(id);
			expect(
				db.prepare('SELECT 1 FROM identities WHERE user_id=?').get(current.ownerId)
			).toBeUndefined();
			expect(revisionFor(id, 1)).toEqual(before[index]);
			expect(revisionFor(id).checksum).toBe(before[index].checksum);
			expect(readPackageFile(revisionFor(id), 'scripts/run.sh')).toEqual(
				readPackageFile(before[index], 'scripts/run.sh')
			);
		});
		expect(refineCatalog(admin, () => {})).toEqual({
			removed: 0,
			hidden: 0,
			reassigned: 0,
			revised: 0,
			unresolved: 0
		});
		catalogOwner('ianfoster', 'other');
		expect(refineCatalog(admin, () => {}).reassigned).toBe(1);
		expect(getSkill(ids.at(-1)!).ownerId).toBe(other.id);
		expect(catalogOwner('ianfoster')).toBe(other.id);
	});
	it('assigns APS author overrides before transferring the remaining shared skills and MCPs to the default maintainer', () => {
		db.prepare(
			"INSERT INTO users (id,username,display_name) VALUES ('aps-curated-library','curated','APS curated library')"
		).run();
		const library = userById('aps-curated-library')!;
		const ptychodus = ['add-plugin', 'add-reconstructor', 'check-layers'].map((name) =>
			skill(name, 'AdvancedPhotonSource/ptychodus', `.claude/skills/${name}`, library)
		);
		const apex = skill(
			'apexa-report',
			'AdvancedPhotonSource/APEXA-APS-Beamline-Assistant',
			'.agents/skills/apexa-report',
			library
		);
		const authored = skill('hub-authored', undefined, undefined, library);
		const form = new FormData();
		form.set('applicationType', 'mcp');
		form.set('instructions', 'Run the configured server.');
		const mcp = publish(library, mcpPackage('hub-mcp', 'APS tools', 'Run the configured server.'), {
			...meta,
			...detailsFromForm(form)
		});
		const originals = [authored, mcp].map((id) => revisionFor(id));
		expect(refineCatalog(admin, () => {})).toMatchObject({ reassigned: 6, revised: 4 });
		for (const id of ptychodus)
			expect(getSkill(id)).toMatchObject({
				displayName: 'Steve Henke',
				ownerId: catalogOwner('stevehenke'),
				upstreamAuthor: 'Steve Henke'
			});
		expect(getSkill(apex)).toMatchObject({
			displayName: 'Pawan Tripathi',
			ownerId: catalogOwner('pawantr'),
			upstreamAuthor: 'Pawan Tripathi'
		});
		[authored, mcp].forEach((id, index) => {
			expect(getSkill(id)).toMatchObject({ ownerId: admin.id, maintainerId: admin.id });
			expect(revisionFor(id)).toEqual(originals[index]);
		});
		expect(
			db.prepare("SELECT 1 FROM skills WHERE owner_id='aps-curated-library'").get()
		).toBeUndefined();
		expect(refineCatalog(admin, () => {})).toMatchObject({ reassigned: 0, revised: 0 });
	});
	it('publishes only the selected EAA-Pi skill and preserves its package on repeat imports', () => {
		const before = (db.prepare('SELECT count(*) AS n FROM skills').get() as { n: number }).n;
		const run = () =>
			execFileSync(
				process.execPath,
				[
					'--import',
					'tsx',
					'scripts/import-catalog.ts',
					'--local-only',
					'--skill',
					'aps-eaa-pi-setup'
				],
				{ env: process.env, encoding: 'utf8' }
			);
		run();
		const results = searchSkills(new URLSearchParams({ q: 'aps-eaa-pi-setup', exact: '1' }));
		expect(results.total).toBe(1);
		const entry = results.skills[0];
		expect(entry).toMatchObject({
			ownerId: catalogOwner('ming-du'),
			maintainerId: catalogOwner('ming-du'),
			applicationType: 'skill',
			sourceUrl: 'https://github.com/AdvancedPhotonSource/EAA-Pi'
		});
		expect(entry.owners.map((owner) => owner.displayName)).toEqual(['Ming Du']);
		expect(revisionFor(entry.id).files.map((file) => file.path)).toContain('references/setup.md');
		expect(run()).toContain('Already published: aps-eaa-pi-setup');
		expect(getSkill(entry.id).revision).toBe(1);
		expect(refineCatalog(admin, () => {})).toMatchObject({ reassigned: 0, revised: 0 });
		expect((db.prepare('SELECT count(*) AS n FROM skills').get() as { n: number }).n).toBe(
			before + 1
		);
	});
	it('hides paused skills while retaining their ownership, package and history across imports', () => {
		const id = skill('aps-gsas-ii-powder-refinement');
		const revision = revisionFor(id);
		expect(refineCatalog(admin, () => {})).toMatchObject({ hidden: 1 });
		const owner = userById(catalogOwner('brian-toby'))!;
		expect(getSkill(id, owner)).toMatchObject({
			archived: true,
			ownerId: catalogOwner('brian-toby')
		});
		expect(() => getSkill(id, admin)).toThrow('not found');
		expect(() => getSkill(id, other)).toThrow('not found');
		expect(
			searchSkills(new URLSearchParams({ q: 'aps-gsas-ii-powder-refinement', exact: '1' })).total
		).toBe(0);
		expect(
			execFileSync(
				process.execPath,
				[
					'--import',
					'tsx',
					'scripts/import-catalog.ts',
					'--local-only',
					'--skill',
					'aps-gsas-ii-powder-refinement'
				],
				{ env: process.env, encoding: 'utf8' }
			)
		).toContain('Hidden; import skipped');
		expect(getSkill(id, owner).archived).toBe(true);
		expect(revisionFor(id)).toEqual(revision);
		expect(readPackageFile(revision, 'scripts/run.sh').toString()).toContain('exit 0');
		expect(refineCatalog(admin, () => {})).toMatchObject({ hidden: 0 });
	});
	it('migrates recognized old beamline spellings and reports unknown tags without losing them', () => {
		const id = skill('legacy-contexts');
		db.prepare("UPDATE skills SET details=json_set(details, '$.contexts', json(?)) WHERE id=?").run(
			'["APS","2IDD","2-ID-D"]',
			id
		);
		const unknown = skill('unknown-contexts');
		db.prepare("UPDATE skills SET details=json_set(details, '$.contexts', json(?)) WHERE id=?").run(
			'["retired-beamline"]',
			unknown
		);
		const messages: string[] = [];
		expect(refineCatalog(admin, (message) => messages.push(message))).toMatchObject({
			revised: 1,
			unresolved: 1
		});
		expect(getSkill(id).contexts).toEqual(['aps', '2-id-d']);
		expect(
			searchSkills(new URLSearchParams({ context: '2IDD' })).skills.map((s) => s.id)
		).toContain(id);
		expect(getSkill(unknown).contexts).toEqual(['retired-beamline']);
		expect(messages).toContain('Needs context review: unknown-contexts: retired-beamline');
	});
});
