import { createHash } from 'node:crypto';
import { HubError } from './errors';
import { maxExpanded, maxFile, safePath, validatePackage, type PackageFile } from './packages';

type TreeEntry = { path: string; mode: string; type: string; sha: string; size?: number };
export type RepositorySnapshot = {
	repository: string;
	ref: string;
	commit: string;
	commitDate: string;
	directory: string;
	directories: string[];
	tree: TreeEntry[];
};

// Only immutable snapshots are cached. Branches are resolved again on every refresh.
const snapshots = new Map<string, RepositorySnapshot>();
const legalName = /^(license|licence|copying|notice|third[_-]party[_-]notices)([._-].*)?$/i;
const encodePath = (path: string) => path.split('/').map(encodeURIComponent).join('/');

export function parseRepository(input: string, ref = '') {
	let url: URL;
	try {
		url = new URL(input);
	} catch {
		throw new HubError('Enter an HTTPS GitHub repository or skill-directory URL.');
	}
	if (url.origin !== 'https://github.com' || url.username || url.password || url.search || url.hash)
		throw new HubError(
			'Use a public https://github.com repository URL without credentials or query parameters.'
		);
	let parts: string[];
	try {
		parts = url.pathname.replace(/\/$/, '').split('/').slice(1).map(decodeURIComponent);
	} catch {
		throw new HubError('Invalid repository URL.');
	}
	const [owner, rawRepo, kind, branch, ...folders] = parts;
	const repo = rawRepo?.replace(/\.git$/, '');
	if (
		!owner ||
		!repo ||
		!/^[A-Za-z0-9][A-Za-z0-9-]{0,38}$/.test(owner) ||
		!/^[A-Za-z0-9_.-]{1,100}$/.test(repo) ||
		['.', '..'].includes(repo) ||
		(parts.length > 2 && (kind !== 'tree' || !branch))
	)
		throw new HubError('Use a repository URL or /tree/<ref>/<skill-directory> URL.');
	ref = ref.trim() || branch || '';
	if (
		ref &&
		(!/^[A-Za-z0-9][A-Za-z0-9._/-]{0,199}$/.test(ref) ||
			ref.includes('..') ||
			ref.includes('//') ||
			ref.endsWith('/'))
	)
		throw new HubError('Invalid Git branch, tag, or commit.');
	const directory = folders.join('/');
	if (directory && !safePath(directory)) throw new HubError('Invalid skill directory.');
	return { repository: `${owner}/${repo}`, ref, directory };
}

async function request(url: string, limit: number, signal: AbortSignal) {
	const headers: Record<string, string> = {
		'User-Agent': 'APS-Skills-Hub',
		Accept: 'application/vnd.github+json'
	};
	if (url.startsWith('https://api.github.com/') && process.env.GITHUB_TOKEN)
		headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
	try {
		const response = await fetch(url, { headers, redirect: 'error', signal });
		if (!response.ok) {
			await response.body?.cancel();
			if ([403, 429].includes(response.status))
				throw new HubError(
					'GitHub request limit reached. Try later or configure a server-side GITHUB_TOKEN.',
					503
				);
			if (response.status === 404)
				throw new HubError('Public repository, revision, or file not found on GitHub.');
			throw new HubError('GitHub could not complete the import. Please try again.', 502);
		}
		if (Number(response.headers.get('content-length')) > limit) {
			await response.body?.cancel();
			throw new HubError('Upstream response exceeds the import size limit.');
		}
		if (!response.body) throw new HubError('GitHub returned an empty response.', 502);
		const reader = response.body.getReader();
		const chunks: Uint8Array[] = [];
		let size = 0;
		while (true) {
			const { value, done } = await reader.read();
			if (done) break;
			size += value.length;
			if (size > limit) {
				await reader.cancel();
				throw new HubError('Upstream response exceeds the import size limit.');
			}
			chunks.push(value);
		}
		return Buffer.concat(chunks);
	} catch (error) {
		if (error instanceof HubError) throw error;
		throw new HubError(
			'GitHub is unavailable, redirected, or timed out. Use the current repository URL and try again.',
			502
		);
	}
}

export async function inspectRepository(
	input: string,
	reference = ''
): Promise<RepositorySnapshot> {
	const parsed = parseRepository(input, reference);
	const key = `${parsed.repository.toLowerCase()}:${parsed.ref}`;
	if (/^[a-f0-9]{40}$/.test(parsed.ref) && snapshots.has(key))
		return { ...snapshots.get(key)!, ref: parsed.ref, directory: parsed.directory };
	const signal = AbortSignal.timeout(30000);
	const api = `https://api.github.com/repos/${parsed.repository}`;
	const repo = JSON.parse((await request(api, 256000, signal)).toString());
	if (repo.private !== false)
		throw new HubError('Only public GitHub repositories can be imported.');
	const ref = parsed.ref || repo.default_branch;
	parseRepository(input, ref);
	const commit = JSON.parse(
		(await request(`${api}/commits/${encodeURIComponent(ref)}`, 2000000, signal)).toString()
	);
	if (
		!/^[a-f0-9]{40}$/.test(commit.sha) ||
		!/^[a-f0-9]{40}$/.test(commit.commit?.tree?.sha) ||
		!Number.isFinite(Date.parse(commit.commit?.committer?.date))
	)
		throw new HubError('GitHub returned invalid commit metadata.', 502);
	const tree = JSON.parse(
		(
			await request(
				`${api}/git/trees/${commit.commit.tree.sha}?recursive=1`,
				8 * 1024 * 1024,
				signal
			)
		).toString()
	);
	if (tree.truncated || !Array.isArray(tree.tree))
		throw new HubError(
			'This repository tree is incomplete or too large to import. Use a smaller skills repository.'
		);
	const entries: TreeEntry[] = tree.tree;
	const directories = entries
		.filter(
			(entry) =>
				entry.type === 'blob' && (entry.path === 'SKILL.md' || entry.path.endsWith('/SKILL.md'))
		)
		.map((entry) => (entry.path === 'SKILL.md' ? '' : entry.path.slice(0, -9)))
		.sort();
	if (!directories.length) throw new HubError('No SKILL.md files were found at this revision.');
	const snapshot = {
		repository: parsed.repository,
		ref,
		commit: commit.sha,
		commitDate: commit.commit.committer.date,
		directory: parsed.directory,
		directories,
		tree: entries
	};
	if (snapshots.size >= 16) snapshots.delete(snapshots.keys().next().value!);
	snapshots.set(`${parsed.repository.toLowerCase()}:${commit.sha}`, snapshot);
	return snapshot;
}

export async function importDirectory(
	snapshot: RepositorySnapshot,
	directory: string,
	ref = snapshot.ref
) {
	if ((directory && !safePath(directory)) || !snapshot.directories.includes(directory))
		throw new HubError('Select a skill directory from this repository.');
	parseRepository(`https://github.com/${snapshot.repository}`, ref);
	const prefix = directory ? `${directory}/` : '';
	const selected = snapshot.tree.filter(
		(entry) => entry.type !== 'tree' && entry.path.startsWith(prefix)
	);
	const ancestorPaths = new Set(['']);
	const parts = directory.split('/');
	for (let i = 1; i < parts.length; i++) ancestorPaths.add(parts.slice(0, i).join('/'));
	const ancestors = snapshot.tree.filter((entry) => {
		const slash = entry.path.lastIndexOf('/');
		return (
			entry.type !== 'tree' &&
			ancestorPaths.has(entry.path.slice(0, Math.max(0, slash))) &&
			legalName.test(entry.path.slice(slash + 1)) &&
			!selected.includes(entry)
		);
	});
	const entries = [
		...selected.map((entry) => ({ entry, path: entry.path.slice(prefix.length) })),
		...ancestors.map((entry) => ({ entry, path: `_upstream/${entry.path}` }))
	];
	if (
		!entries.length ||
		entries.length > 200 ||
		entries.reduce((sum, { entry }) => sum + (entry.size || 0), 0) > maxExpanded
	)
		throw new HubError('This skill exceeds the 200-file or 25 MB package limit.');
	for (const { entry, path } of entries) {
		if (
			entry.type !== 'blob' ||
			!['100644', '100755'].includes(entry.mode) ||
			!safePath(path) ||
			!/^[a-f0-9]{40}$/.test(entry.sha) ||
			!Number.isSafeInteger(entry.size) ||
			entry.size! < 0 ||
			entry.size! > maxFile
		)
			throw new HubError(
				'Skill contains unsupported links, submodules, paths, or oversized files.'
			);
	}
	const signal = AbortSignal.timeout(90000);
	const files: PackageFile[] = [];
	// Bounded concurrency keeps large reference packages from flooding upstream.
	for (let i = 0; i < entries.length; i += 6) {
		files.push(
			...(await Promise.all(
				entries.slice(i, i + 6).map(async ({ entry, path }) => {
					const data = await request(
						`https://raw.githubusercontent.com/${snapshot.repository}/${snapshot.commit}/${encodePath(entry.path)}`,
						maxFile,
						signal
					);
					const hash = createHash('sha1')
						.update(`blob ${data.length}\0`)
						.update(data)
						.digest('hex');
					if (data.length !== entry.size || hash !== entry.sha)
						throw new HubError('An upstream file does not match its pinned Git revision.', 502);
					if (
						data
							.subarray(0, 100)
							.toString()
							.startsWith('version https://git-lfs.github.com/spec/v1')
					)
						throw new HubError(
							'Git LFS packages are not supported; this import would be incomplete.'
						);
					return { path, data, mode: entry.mode === '100755' ? 0o755 : 0o644 };
				})
			))
		);
	}
	const pkg = validatePackage(files);
	pkg.source = {
		repository: snapshot.repository,
		directory,
		ref,
		commit: snapshot.commit,
		commitDate: snapshot.commitDate,
		author: snapshot.repository.split('/')[0],
		licenses: entries
			.filter(({ entry }) => legalName.test(entry.path.split('/').at(-1)!))
			.map(({ entry, path }) => ({ path, repositoryPath: entry.path }))
	};
	return pkg;
}
