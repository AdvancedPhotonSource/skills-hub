import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { zipSync, unzipSync } from 'fflate';

const directory = mkdtempSync(join(tmpdir(), 'aps-hub-test-'));
process.env.DATA_DIR = directory;
const { db } = await import('../src/lib/server/db');
const { register, authenticate, createSession, sessionUser, resetPassword, allowAttempt } =
	await import('../src/lib/server/auth');
const { parseUpload, validatePackage, mcpPackage } = await import('../src/lib/server/packages');
const { detailsFromForm } = await import('../src/lib/server/details');
const {
	publish,
	getSkill,
	requireOwner,
	revisionFor,
	readPackageFile,
	download,
	searchSkills,
	taxonomyCounts,
	deleteEntry
} = await import('../src/lib/server/catalog');
const { renderMarkdown } = await import('../src/lib/server/markdown');

let alice: Awaited<ReturnType<typeof register>>;
let bob: typeof alice;
let skillId: string;
const original = Buffer.from(
	'---\nname: test-science\ndescription: Inspect scientific datasets with Python\n---\n\n# Dataset exploration\n\nUse HDF5 metadata first.\n'
);
const metadata = { categories: ['reduction'], tags: ['python', 'hdf5'], role: 'Researcher' };
const pkg = () =>
	validatePackage([
		{ path: 'SKILL.md', data: original, mode: 0o644 },
		{ path: 'assets/sample.bin', data: Buffer.from([0, 1, 255]), mode: 0o644 }
	]);

beforeAll(async () => {
	alice = await register('alice', 'long-passphrase-for-alice', 'Alice');
	bob = await register('bob', 'long-passphrase-for-bob', 'Bob');
	db.prepare('UPDATE users SET verified=1 WHERE id IN (?, ?)').run(alice.id, bob.id);
	skillId = publish(alice, pkg(), metadata);
});
afterAll(() => {
	db.close();
	rmSync(directory, { recursive: true, force: true });
});

describe('accounts and ownership', () => {
	it('authenticates with normalized usernames, rejects incorrect passwords, and stores password hashes', async () => {
		expect((await authenticate('ALICE', 'long-passphrase-for-alice'))?.id).toBe(alice.id);
		expect(await authenticate('alice', 'wrong-password')).toBeNull();
		expect(await authenticate('unknown', 'wrong-password')).toBeNull();
		const row = db.prepare("SELECT password_hash FROM identities WHERE subject='alice'").get() as {
			password_hash: string;
		};
		expect(row.password_hash).toMatch(/^\$argon2id\$/);
		await expect(register('ALICE', 'some-other-long-password', '')).rejects.toThrow(
			'already taken'
		);
	});
	it('revokes all existing sessions when resetting a password', async () => {
		const first = createSession(bob.id);
		const second = createSession(bob.id);
		expect(sessionUser(first)?.id).toBe(bob.id);
		expect(db.prepare('SELECT 1 FROM sessions WHERE token_hash=?').get(first)).toBeUndefined();
		await resetPassword(bob.id, 'a-new-long-passphrase');
		expect(sessionUser(first)).toBeNull();
		expect(sessionUser(second)).toBeNull();
		expect((await authenticate('bob', 'a-new-long-passphrase'))?.id).toBe(bob.id);
	});
	it('blocks anonymous and other-account edits before modifying files or metadata', () => {
		expect(() => requireOwner(skillId, null)).toThrow('Sign in');
		expect(() => publish(bob, pkg(), metadata, { id: skillId, expected: 1 })).toThrow(
			'Only the owner'
		);
		expect(() => deleteEntry(skillId, bob, 1)).toThrow('Only the owner');
		expect(getSkill(skillId).revision).toBe(1);
		expect(getSkill(skillId).ownerId).toBe(alice.id);
	});
	it('limits repeated authentication attempts', () => {
		expect(allowAttempt('rate-test', 2)).toBe(true);
		expect(allowAttempt('rate-test', 2)).toBe(true);
		expect(allowAttempt('rate-test', 2)).toBe(false);
	});
});

describe('catalog integrity', () => {
	it('searches content, prefixes, phrases, and descendant taxonomy without exposing SQL syntax', () => {
		for (const q of ['HDF5', 'sci', '"scientific datasets"', 'test-science'])
			expect(searchSkills(new URLSearchParams({ q })).total).toBe(1);
		expect(searchSkills(new URLSearchParams({ q: 'OR NOT * "' })).total).toBe(0);
		expect(searchSkills(new URLSearchParams({ category: 'science', tag: 'python' })).total).toBe(1);
		expect(searchSkills(new URLSearchParams({ q: 'test-science', exact: '1' })).total).toBe(1);
		expect(searchSkills(new URLSearchParams({ q: 'test', exact: '1' })).total).toBe(0);
		expect(taxonomyCounts().find((c) => c.id === 'science')?.count).toBe(1);
	});
	it('retains exact package bytes and immutable older revisions, rejecting stale updates', () => {
		const previous = revisionFor(skillId, 1);
		expect(readPackageFile(previous, 'SKILL.md')).toEqual(original);
		const next = pkg();
		next.files[0].data = Buffer.from('a changed file');
		publish(alice, next, metadata, { id: skillId, expected: 1 });
		expect(getSkill(skillId).revision).toBe(2);
		expect(readPackageFile(previous, 'SKILL.md')).toEqual(original);
		expect(() => publish(alice, pkg(), metadata, { id: skillId, expected: 1 })).toThrow(
			'changed since'
		);
		expect(() => readPackageFile(previous, '../../hub.sqlite')).toThrow('File not found');
		const zip = unzipSync(download(getSkill(skillId), previous));
		expect(Buffer.from(zip['test-science/SKILL.md'])).toEqual(original);
		expect([...zip['test-science/assets/sample.bin']]).toEqual([0, 1, 255]);
	});
	it('keeps legacy archived entries private until they are migrated or deleted', () => {
		db.prepare('UPDATE skills SET archived=1 WHERE id=?').run(skillId);
		expect(() => getSkill(skillId)).toThrow('not found');
		expect(() => getSkill(skillId, bob)).toThrow('not found');
		expect(getSkill(skillId, alice).archived).toBe(true);
		expect(searchSkills(new URLSearchParams()).total).toBe(0);
		db.prepare('UPDATE skills SET archived=0 WHERE id=?').run(skillId);
		expect(searchSkills(new URLSearchParams()).total).toBe(1);
	});
});

describe('packages and previews', () => {
	const upload = (entries: Record<string, Uint8Array>) =>
		parseUpload(new File([zipSync(entries)], 'skill.zip'));
	it('accepts a complete nested skill and keeps binary companions', async () => {
		const result = await upload({
			'test-science/SKILL.md': original,
			'test-science/assets/sample.bin': new Uint8Array([0, 255])
		});
		expect(result.name).toBe('test-science');
		expect(result.files.find((f) => f.path === 'assets/sample.bin')?.data).toEqual(
			Buffer.from([0, 255])
		);
	});
	it('rejects traversal, oversized expansion, multiple roots, and mismatched folder names', async () => {
		await expect(upload({ '../SKILL.md': original })).rejects.toThrow();
		await expect(
			upload({
				'test-science/SKILL.md': original,
				'test-science/huge.txt': new Uint8Array(6 * 1024 * 1024)
			})
		).rejects.toThrow('5 MB');
		await expect(upload({ 'one/SKILL.md': original, 'two/SKILL.md': original })).rejects.toThrow(
			'one skill'
		);
		await expect(upload({ 'wrong-name/SKILL.md': original })).rejects.toThrow('folder name');
	});
	it('rejects invalid frontmatter and renders source instructions inertly', () => {
		expect(() =>
			validatePackage([{ path: 'SKILL.md', data: Buffer.from('# Missing metadata'), mode: 0o644 }])
		).toThrow('frontmatter');
		const html = renderMarkdown(
			'# Hello\n<script>alert(1)</script><img src=x onerror=alert(1)>[click](javascript:alert(1))<iframe src="https://example.com"></iframe>'
		);
		expect(html).toContain('<h1>Hello</h1>');
		expect(html).not.toMatch(/<script|onerror|href="javascript:|<iframe|<img/);
	});
	it('resolves companion links within the selected immutable revision', () => {
		const html = renderMarkdown('[Reference](../references/guide.md) [Bad](javascript:alert(1))', {
			path: 'scripts/README.md',
			revision: 3,
			files: [{ path: 'references/guide.md' }]
		});
		expect(html).toContain('?revision=3&amp;file=references%2Fguide.md');
		expect(html).not.toContain('javascript:');
	});
});

describe('imported revisions', () => {
	it('keeps provenance separate from ownership, preserves old imports, and serves downloads offline', () => {
		const imported = pkg();
		imported.source = {
			repository: 'upstream/science',
			directory: 'skills/test-science',
			ref: 'main',
			commit: 'a'.repeat(40),
			commitDate: '2026-10-01T00:00:00Z',
			author: 'upstream',
			licenses: []
		};
		const importedMetadata = {
			...metadata,
			example: 'Inspect my HDF5 file.',
			relevance: 'Inspect beamline HDF5 datasets.'
		};
		const id = publish(bob, imported, importedMetadata);
		const first = revisionFor(id);
		expect(getSkill(id)).toMatchObject({
			ownerId: bob.id,
			example: 'Inspect my HDF5 file.',
			source: { author: 'upstream' }
		});
		expect(
			searchSkills(new URLSearchParams({ author: 'upstream' })).skills.map((skill) => skill.id)
		).toEqual([id]);
		expect(searchSkills(new URLSearchParams({ repository: 'UPSTREAM/SCIENCE' })).total).toBe(1);
		expect(searchSkills(new URLSearchParams({ origin: 'imported' })).total).toBe(1);
		expect(() => publish(alice, imported, metadata, { id, expected: 1 })).toThrow('Only the owner');
		imported.source = { ...imported.source, commit: 'b'.repeat(40) };
		publish(bob, imported, importedMetadata, { id, expected: 1 });
		expect(revisionFor(id).source?.commit).toBe('b'.repeat(40));
		expect(revisionFor(id, 1).source?.commit).toBe('a'.repeat(40));
		expect(() => publish(bob, imported, importedMetadata, { id, expected: 1 })).toThrow(
			'changed since'
		);
		expect(Buffer.from(unzipSync(download(getSkill(id), first))['test-science/SKILL.md'])).toEqual(
			original
		);
	});
});

describe('typed contributions and maintenance', () => {
	it('requires verification even when the caller holds an older verified user object', async () => {
		const newcomer = await register('newcomer', 'a-long-newcomer-passphrase', 'Newcomer');
		expect(() => publish(newcomer, pkg(), metadata)).toThrow('verify your account');
		db.prepare('UPDATE users SET verified=0 WHERE id=?').run(alice.id);
		expect(() => publish(alice, pkg(), metadata, { id: skillId, expected: 2 })).toThrow(
			'verify your account'
		);
		db.prepare('UPDATE users SET verified=1 WHERE id=?').run(alice.id);
	});
	it('publishes an MCP without SKILL.md, filters facets, preserves snapshots, and deletes files completely', () => {
		db.prepare('UPDATE users SET default_maintainer=1 WHERE id=?').run(alice.id);
		const form = new FormData();
		for (const [key, value] of Object.entries({
			applicationType: 'mcp',
			contexts: 'APS, 2-ID-D',
			deployment: 'self-hosted',
			access: 'internal',
			transport: 'http',
			instructions: 'Start the configured server.',
			mcpRepository: 'https://github.com/APS/example'
		}))
			form.set(key, value);
		form.append('technique', 'xrf');
		const details = detailsFromForm(form);
		const mcp = mcpPackage(
			'xrf-server',
			'Render beamline fluorescence maps',
			details.mcp!.instructions
		);
		const id = publish(bob, mcp, { ...metadata, ...details });
		expect(getSkill(id)).toMatchObject({
			ownerId: bob.id,
			maintainerId: alice.id,
			applicationType: 'mcp',
			mcp: { deployment: 'self-hosted', access: 'internal' }
		});
		expect(requireOwner(id, alice).id).toBe(id);
		expect(
			searchSkills(
				new URLSearchParams({ type: 'mcp', context: 'aps', technique: 'xrf' })
			).skills.map((s) => s.id)
		).toEqual([id]);
		expect(searchSkills(new URLSearchParams({ type: 'skill', technique: 'xrf' })).total).toBe(0);
		expect(searchSkills(new URLSearchParams({ q: 'xrf' })).skills.some((s) => s.id === id)).toBe(
			true
		);
		const first = revisionFor(id);
		expect(first.files.map((f) => f.path)).toEqual(['README.md']);
		const reference = Buffer.from('# Sources\n\nhttps://example.org/xrf\n');
		mcp.files.push(
			{ path: 'SKILL.md', data: original, mode: 0o644 },
			{ path: 'legacy/SKILL.md', data: original, mode: 0o644 },
			{ path: 'references/sources.md', data: reference, mode: 0o644 }
		);
		publish(
			bob,
			mcp,
			{ ...metadata, ...details, mcp: { ...details.mcp!, deployment: 'hosted' } },
			{ id, expected: 1 }
		);
		expect(revisionFor(id, 1).details.mcp?.deployment).toBe('self-hosted');
		expect(revisionFor(id).details.mcp?.deployment).toBe('hosted');
		expect(revisionFor(id).files.map((file) => file.path)).toEqual([
			'README.md',
			'references/sources.md'
		]);
		expect(readPackageFile(revisionFor(id), 'references/sources.md')).toEqual(reference);
		const archive = unzipSync(download(getSkill(id), revisionFor(id)));
		expect(Object.keys(archive)).toEqual([
			'xrf-server/README.md',
			'xrf-server/references/sources.md'
		]);
		expect(Buffer.from(archive['xrf-server/references/sources.md'])).toEqual(reference);
		expect(() => deleteEntry(id, alice, 1)).toThrow('changed');
		const latest = revisionFor(id);
		deleteEntry(id, alice, 2);
		expect(() => getSkill(id)).toThrow('not found');
		expect(searchSkills(new URLSearchParams({ type: 'mcp' })).total).toBe(0);
		expect(db.prepare('SELECT 1 FROM revisions WHERE skill_id=?').get(id)).toBeUndefined();
		for (const revision of [first, latest])
			expect(existsSync(join(directory, 'packages', revision.id))).toBe(false);
		db.prepare('UPDATE users SET default_maintainer=0').run();
	});
	it('requires external attribution for local uploads and rejects unsafe MCP URLs', () => {
		expect(() => publish(bob, pkg(), { ...metadata, provenance: 'external' })).toThrow(
			'External contributions'
		);
		const form = new FormData();
		form.set('applicationType', 'mcp');
		form.set('instructions', 'Run the server.');
		form.set('mcpRepository', 'javascript:alert(1)');
		expect(() => detailsFromForm(form)).toThrow('HTTP(S)');
		form.set('mcpRepository', 'https://example.org/server');
		form.set('access', 'invented');
		expect(() => detailsFromForm(form)).toThrow('valid access');
	});
});
