import { afterAll, describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { unzipSync } from 'fflate';

const directory = mkdtempSync(join(tmpdir(), 'aps-collections-'));
process.env.DATA_DIR = directory;
const { db } = await import('../src/lib/server/db');
const { userById } = await import('../src/lib/server/auth');
const {
	publish,
	getSkill,
	revisionFor,
	download,
	searchSkills,
	collectionMembers,
	memberCollections,
	deleteEntry
} = await import('../src/lib/server/catalog');
const { validatePackage, mcpPackage } = await import('../src/lib/server/packages');
db.prepare(
	"INSERT INTO users (id,username,display_name) VALUES ('owner','owner','Owner'),('other','other','Other')"
).run();
const owner = userById('owner')!;
const other = userById('other')!;
const meta = { categories: ['reduction'], tags: ['python'], role: '' };
const packageFor = (name: string) =>
	validatePackage([
		{
			path: 'SKILL.md',
			mode: 0o644,
			data: Buffer.from(
				`---\nname: ${name}\ndescription: Analyze diffraction data\n---\nInstructions`
			)
		}
	]);
const first = publish(owner, packageFor('collection-analysis'), meta);
const second = publish(owner, mcpPackage('collection-tools', 'Analysis tools', 'Run the tools.'), {
	...meta,
	applicationType: 'mcp',
	mcp: {
		repository: '',
		documentation: '',
		deployment: 'self-hosted',
		access: 'internal',
		transport: 'stdio',
		endpoint: '',
		authentication: '',
		configuration: '',
		instructions: 'Run the tools.',
		tools: ''
	}
});
const bundle = mcpPackage(
	'analysis-collection',
	'A complete analysis workflow',
	'Browse the entries.'
);
const collectionMeta = {
	...meta,
	applicationType: 'collection' as const,
	collectionTitle: 'Diffraction collection',
	collectionMembers: [first, second]
};
const collection = publish(owner, bundle, collectionMeta);

afterAll(() => {
	db.close();
	rmSync(directory, { recursive: true, force: true });
});

describe('collections', () => {
	it('groups Explore without losing individual search results or type filters', () => {
		const grouped = searchSkills(new URLSearchParams({ grouped: '1' }));
		expect(grouped.total).toBe(1);
		expect(grouped.skills[0]).toMatchObject({ id: collection, memberCount: 2 });
		expect(searchSkills(new URLSearchParams({ q: 'collection-analysis' })).skills[0].id).toBe(
			first
		);
		expect(searchSkills(new URLSearchParams({ type: 'mcp' })).skills[0].id).toBe(second);
		expect(
			searchSkills(new URLSearchParams({ q: 'Diffraction', type: 'collection' })).skills[0].id
		).toBe(collection);
		expect(memberCollections(first).map((entry) => entry.id)).toEqual([collection]);
	});
	it('bundles skills and MCPs in separate folders without changing their owners or revisions', () => {
		const files = unzipSync(download(getSkill(collection), revisionFor(collection)));
		expect(Object.keys(files)).toEqual([
			'collection-analysis/SKILL.md',
			'collection-tools/README.md'
		]);
		expect(Buffer.from(files['collection-analysis/SKILL.md'])).toEqual(
			packageFor('collection-analysis').files[0].data
		);
		expect(getSkill(first)).toMatchObject({ ownerId: owner.id, revision: 1 });
	});
	it('rejects unauthorized membership, nested collections, too few members, and stale edits', () => {
		expect(() => publish(other, bundle, collectionMeta)).toThrow('only add');
		expect(() =>
			publish(owner, bundle, { ...collectionMeta, collectionMembers: [first, collection] })
		).toThrow('not other collections');
		expect(() =>
			publish(owner, bundle, { ...collectionMeta, collectionMembers: [first, first] })
		).toThrow('between two');
		expect(() => publish(other, bundle, collectionMeta, { id: collection, expected: 1 })).toThrow(
			'Only the owner'
		);
		expect(() => publish(owner, bundle, collectionMeta, { id: collection, expected: 0 })).toThrow(
			'changed since'
		);
		expect(getSkill(collection).revision).toBe(1);
	});
	it('hides archived members and tolerates deleted members without leaking their files', () => {
		db.prepare('UPDATE skills SET archived=1 WHERE id=?').run(second);
		expect(collectionMembers(getSkill(collection)).map((entry) => entry.id)).toEqual([first]);
		expect(Object.keys(unzipSync(download(getSkill(collection), revisionFor(collection))))).toEqual(
			['collection-analysis/SKILL.md']
		);
		deleteEntry(second, owner, 1);
		expect(getSkill(collection).memberCount).toBe(1);
		deleteEntry(collection, owner, 1);
		expect(
			searchSkills(new URLSearchParams({ grouped: '1' })).skills.map((entry) => entry.id)
		).toContain(first);
	});
	it('deduplicates repository and directory identities across owners', () => {
		const pkg = packageFor('upstream-identity');
		pkg.source = {
			repository: 'AdvancedPhotonSource/ptychodus',
			directory: '.claude/skills/example',
			ref: 'main',
			commit: 'a'.repeat(40),
			commitDate: '2026-11-12T00:00:00Z',
			author: 'AdvancedPhotonSource',
			licenses: []
		};
		publish(owner, pkg, meta);
		expect(() => publish(other, pkg, meta)).toThrow('already in the catalog');
	});
	it('reads colon-containing upstream prose without modifying files or accepting invalid YAML elsewhere', () => {
		const data = Buffer.from(
			'---\nname: upstream-prose\ndescription: Analyze data\ncompatibility: Python 3.12. Setup: docs/SETUP.md.\n---\nInstructions'
		);
		const pkg = validatePackage([{ path: 'SKILL.md', mode: 0o644, data }]);
		expect(pkg.compatibility).toBe('Python 3.12. Setup: docs/SETUP.md.');
		expect(pkg.files[0].data).toEqual(data);
		expect(() =>
			validatePackage([
				{
					path: 'SKILL.md',
					mode: 0o644,
					data: Buffer.from(data.toString().replace('name: upstream-prose', 'name: [invalid'))
				}
			])
		).toThrow('invalid YAML');
	});
});
