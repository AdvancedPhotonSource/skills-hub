import { json } from '@sveltejs/kit';
import { getSkill, revisionFor } from '$lib/server/catalog';
import { HubError } from '$lib/server/errors';
export const GET = ({ params }: import('./$types').RequestEvent) => {
	try {
		const skill = getSkill(params.id);
		return json({ skill, revision: revisionFor(skill.id) });
	} catch (e) {
		if (e instanceof HubError) return json({ error: e.message }, { status: e.status });
		throw e;
	}
};
