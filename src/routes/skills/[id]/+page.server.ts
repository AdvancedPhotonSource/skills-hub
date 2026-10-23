import { error } from '@sveltejs/kit';
import {
	getSkill,
	revisionFor,
	revisions,
	readPackageFile,
	searchSkills
} from '$lib/server/catalog';
import { renderMarkdown } from '$lib/server/markdown';
import { HubError } from '$lib/server/errors';
import { validatePackage } from '$lib/server/packages';

export const load = ({ params, url, locals }: import('./$types').PageServerLoadEvent) => {
	try {
		const skill = getSkill(params.id, locals.user);
		const version = url.searchParams.get('revision');
		if (version && !/^[1-9]\d*$/.test(version)) throw new HubError('Invalid revision.');
		const revision = revisionFor(skill.id, version ? Number(version) : undefined);
		const path = url.searchParams.get('file') || 'SKILL.md';
		const buffer = readPackageFile(revision, path);
		const text = buffer.subarray(0, 100000).toString('utf8');
		const binary = buffer.subarray(0, 8000).includes(0) || text.includes('\ufffd');
		return {
			skill,
			projectRepository: revision.source
				? null
				: validatePackage([
						{
							path: 'SKILL.md',
							data: path === 'SKILL.md' ? buffer : readPackageFile(revision, 'SKILL.md'),
							mode: 0o644
						}
					]).projectRepository,
			revision,
			history: revisions(skill.id).map(({ number, createdAt, version }) => ({
				number,
				createdAt,
				version
			})),
			path,
			text: binary ? '' : text,
			binary,
			truncated: buffer.length > 100000,
			html:
				!binary && /\.md$/i.test(path)
					? renderMarkdown(text, { path, revision: revision.number, files: revision.files })
					: null,
			raw: url.searchParams.get('view') === 'source',
			canEdit: skill.ownerId === locals.user?.id || Boolean(locals.user?.isAdmin),
			related: searchSkills(new URLSearchParams({ category: skill.categories[0] || '' }))
				.skills.filter((s) => s.id !== skill.id)
				.slice(0, 3)
		};
	} catch (e) {
		if (e instanceof HubError) error(e.status, e.message);
		throw e;
	}
};
