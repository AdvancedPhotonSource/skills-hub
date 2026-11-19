import { redirect } from '@sveltejs/kit';
import { resolve } from '$app/paths';
import { searchSkills } from '#lib/server/catalog.ts';

export const load = ({ locals, url }: import('./$types').PageServerLoadEvent) => {
	if (!locals.user) redirect(303, resolve(`sign-in`));
	return searchSkills(url.searchParams, locals.user);
};
