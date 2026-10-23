import { error } from '@sveltejs/kit';
import { getSkill, revisionFor, download } from '$lib/server/catalog';
import { HubError } from '$lib/server/errors';
export const GET = ({ params, url, locals }: import('./$types').RequestEvent) => {
	try {
		const skill = getSkill(params.id, locals.user);
		const version = url.searchParams.get('revision');
		if (version && !/^[1-9]\d*$/.test(version)) throw new HubError('Invalid revision.');
		const revision = revisionFor(skill.id, version ? Number(version) : undefined);
		return new Response(download(skill, revision), {
			headers: {
				'Content-Type': 'application/zip',
				'Content-Disposition': `attachment; filename="${revision.name}-r${revision.number}.zip"`
			}
		});
	} catch (e) {
		if (e instanceof HubError) error(e.status, e.message);
		throw e;
	}
};
