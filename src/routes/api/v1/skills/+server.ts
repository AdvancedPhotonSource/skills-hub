import { json } from '@sveltejs/kit';
import { searchSkills } from '$lib/server/catalog';
export const GET = ({ url }: import('./$types').RequestEvent) =>
	json(searchSkills(url.searchParams));
