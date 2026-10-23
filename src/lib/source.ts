import type { ImportSource } from './types';

export const repositoryUrl = (source: ImportSource) => `https://github.com/${source.repository}`;
export const sourceUrl = (source: ImportSource) =>
	`${repositoryUrl(source)}/tree/${source.commit}/${source.directory.split('/').map(encodeURIComponent).join('/')}`;
