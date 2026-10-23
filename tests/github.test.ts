import { createHash } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { importDirectory, inspectRepository, parseRepository } from '../src/lib/server/github';

const sha = 'a'.repeat(40);
const next = 'b'.repeat(40);
const contents: Record<string, Buffer> = {
	'skills/demo/SKILL.md': Buffer.from(
		'---\nname: demo\ndescription: A useful test skill\n---\n# Demo\n'
	),
	'skills/demo/scripts/run.py': Buffer.from('print("example")\n'),
	'skills/demo/assets/data.bin': Buffer.from([0, 255, 127]),
	'skills/demo/LICENSE.txt': Buffer.from('Per-skill terms'),
	'skills/NOTICE': Buffer.from('Ancestor attribution'),
	'LICENSE.md': Buffer.from('Repository license'),
	'other/SKILL.md': Buffer.from('Unselected skill')
};
const tree = () =>
	Object.entries(contents).map(([path, data]) => ({
		path,
		type: 'blob',
		mode: path.endsWith('.py') ? '100755' : '100644',
		size: data.length,
		sha: createHash('sha1').update(`blob ${data.length}\0`).update(data).digest('hex')
	}));
let entries = tree();
let branch = sha;
let truncated = false;
let privateRepo = false;
let corrupt = false;
let requests: string[];

beforeEach(() => {
	entries = tree();
	branch = sha;
	truncated = false;
	privateRepo = false;
	corrupt = false;
	requests = [];
	vi.stubGlobal(
		'fetch',
		vi.fn(async (input: string, options: RequestInit) => {
			requests.push(input);
			expect(options.redirect).toBe('error');
			const url = new URL(input);
			if (url.hostname === 'raw.githubusercontent.com') {
				expect(url.pathname).toContain(`/${branch}/`);
				const path = url.pathname.split('/').slice(4).join('/');
				return new Response(new Uint8Array(corrupt ? Buffer.from('corrupt') : contents[path]));
			}
			expect(url.hostname).toBe('api.github.com');
			if (url.pathname.includes('/commits/'))
				return Response.json({
					sha: branch,
					commit: { tree: { sha: 'c'.repeat(40) }, committer: { date: '2026-10-01T00:00:00Z' } }
				});
			if (url.pathname.includes('/git/trees/')) return Response.json({ tree: entries, truncated });
			return Response.json({ private: privateRepo, default_branch: 'main' });
		})
	);
});
afterEach(() => vi.unstubAllGlobals());

describe('GitHub import boundaries', () => {
	it('accepts public repository/directory URLs and rejects arbitrary fetch destinations', () => {
		expect(parseRepository('https://github.com/team/repo/tree/main/skills/demo')).toEqual({
			repository: 'team/repo',
			ref: 'main',
			directory: 'skills/demo'
		});
		expect(parseRepository('https://github.com/team/repo.git', 'feature/science').ref).toBe(
			'feature/science'
		);
		for (const url of [
			'http://github.com/team/repo',
			'https://localhost/team/repo',
			'https://github.com.evil.test/team/repo',
			'https://user:pass@github.com/team/repo',
			'https://github.com/team/repo?token=secret',
			'https://github.com/team/repo/tree/main/skills%2F..%2Fdemo'
		])
			expect(() => parseRepository(url)).toThrow();
		expect(requests).toEqual([]);
	});
	it('imports only the selected folder, retains binary bytes and modes, and includes ancestor licenses', async () => {
		const snapshot = await inspectRepository('https://github.com/team/complete');
		expect(snapshot.directories).toEqual(['other', 'skills/demo']);
		const pkg = await importDirectory(snapshot, 'skills/demo');
		expect(pkg.files).toHaveLength(6);
		expect(pkg.files.find((file) => file.path === 'scripts/run.py')?.mode).toBe(0o755);
		expect(pkg.files.find((file) => file.path === 'assets/data.bin')?.data).toEqual(
			contents['skills/demo/assets/data.bin']
		);
		expect(pkg.files.find((file) => file.path === '_upstream/LICENSE.md')?.data).toEqual(
			contents['LICENSE.md']
		);
		expect(pkg.source).toMatchObject({
			repository: 'team/complete',
			commit: sha,
			ref: 'main',
			directory: 'skills/demo',
			author: 'team'
		});
		expect(pkg.source?.licenses.map((file) => file.path).sort()).toEqual([
			'LICENSE.txt',
			'_upstream/LICENSE.md',
			'_upstream/skills/NOTICE'
		]);
		await expect(importDirectory(snapshot, 'missing')).rejects.toThrow('Select a skill');
	});
	it('resolves a moving branch again on refresh', async () => {
		const first = await inspectRepository('https://github.com/team/refresh', 'main');
		const pinned = await inspectRepository('https://github.com/team/refresh', sha);
		expect(pinned.ref).toBe(sha);
		branch = next;
		const second = await inspectRepository('https://github.com/team/refresh', 'main');
		expect(first.commit).toBe(sha);
		expect(second.commit).toBe(next);
		expect((await importDirectory(second, 'skills/demo')).source?.commit).toBe(next);
	});
	it('rejects incomplete or private repositories', async () => {
		truncated = true;
		await expect(inspectRepository('https://github.com/team/truncated')).rejects.toThrow(
			'incomplete'
		);
		truncated = false;
		privateRepo = true;
		await expect(inspectRepository('https://github.com/team/private')).rejects.toThrow('public');
	});
	it('rejects symlinks, submodules and oversized blobs before downloading files', async () => {
		for (const entry of [{ mode: '120000' }, { type: 'commit' }, { size: 6 * 1024 * 1024 }]) {
			entries = tree();
			Object.assign(entries[1], entry);
			const snapshot = await inspectRepository('https://github.com/team/unsafe');
			await expect(importDirectory(snapshot, 'skills/demo')).rejects.toThrow('unsupported');
		}
		expect(requests.some((url) => url.includes('raw.githubusercontent.com'))).toBe(false);
	});
	it('rejects corrupted file responses and Git LFS pointers', async () => {
		let snapshot = await inspectRepository('https://github.com/team/corrupt');
		corrupt = true;
		await expect(importDirectory(snapshot, 'skills/demo')).rejects.toThrow('pinned Git revision');
		corrupt = false;
		const pointer = Buffer.from(
			'version https://git-lfs.github.com/spec/v1\noid sha256:example\nsize 1000\n'
		);
		contents['skills/demo/large.dat'] = pointer;
		entries = tree();
		try {
			snapshot = await inspectRepository('https://github.com/team/lfs');
			await expect(importDirectory(snapshot, 'skills/demo')).rejects.toThrow('Git LFS');
		} finally {
			delete contents['skills/demo/large.dat'];
		}
	});
	it('reports upstream outages and rate limits without leaking credentials', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn(async () => new Response('secret', { status: 403 }))
		);
		await expect(inspectRepository('https://github.com/team/limited')).rejects.toThrow(
			'request limit'
		);
		vi.stubGlobal(
			'fetch',
			vi.fn(async () => {
				throw new Error('private-token');
			})
		);
		await expect(inspectRepository('https://github.com/team/offline')).rejects.toThrow(
			'unavailable'
		);
	});
});
