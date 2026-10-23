import { error } from '@sveltejs/kit';
import { getSkill, revisionFor, readPackageFile } from '$lib/server/catalog';
import { HubError } from '$lib/server/errors';
export const GET = ({ params, url, locals }: import('./$types').RequestEvent) => {
	try {
		const skill = getSkill(params.id, locals.user);
		const version = url.searchParams.get('revision');
		if (version && !/^[1-9]\d*$/.test(version)) throw new HubError('Invalid revision.');
		const revision = revisionFor(skill.id, version ? Number(version) : undefined);
		const path = url.searchParams.get('path') || 'SKILL.md';
		return new Response(readPackageFile(revision, path), {
			headers: {
				'Content-Type': 'application/octet-stream',
				'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(path.split('/').at(-1)!)}`
			}
		});
	} catch (e) {
		if (e instanceof HubError) error(e.status, e.message);
		throw e;
	}
};
