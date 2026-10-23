import { redirect } from '@sveltejs/kit';
import { base } from '$app/paths';
import { searchSkills } from '$lib/server/catalog';

export const load = ({ locals, url }: import('./$types').PageServerLoadEvent) => {
	if (!locals.user) redirect(303, `${base}/sign-in`);
	return searchSkills(url.searchParams, locals.user);
};
