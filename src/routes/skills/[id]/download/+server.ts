import { error } from '@sveltejs/kit';
import { getSkill, revisionFor, download } from '#lib/server/catalog.ts';
import { downloadActor } from '#lib/server/grants.ts';
import { HubError } from '#lib/server/errors.ts';
export const GET = ({ params, url, locals }: import('./$types').RequestEvent) => {
	try {
		// A grant stands in for the session it was minted from, so entry visibility
		// is decided by the same user either way.
		const actor = downloadActor(locals.user, url, params.id);
		const skill = getSkill(params.id, actor);
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
