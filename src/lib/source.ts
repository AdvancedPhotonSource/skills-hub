import type { ImportSource } from './types';

export function projectRepository(value: unknown): string | null {
	if (typeof value !== 'string') return null;
	try {
		const url = new URL(value);
		if (
			url.origin !== 'https://github.com' ||
			url.username ||
			url.password ||
			url.search ||
			url.hash ||
			!/^\/[A-Za-z0-9][A-Za-z0-9-]*\/[A-Za-z0-9_.-]+\/?$/.test(url.pathname)
		)
			return null;
		return `${url.origin}${url.pathname.replace(/\/$/, '')}`;
	} catch {
		return null;
	}
}

export const repositoryUrl = (source: ImportSource) => `https://github.com/${source.repository}`;
export const sourceUrl = (source: ImportSource) =>
	`${repositoryUrl(source)}/tree/${source.commit}/${source.directory.split('/').map(encodeURIComponent).join('/')}`;
