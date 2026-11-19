import { json } from '@sveltejs/kit';
import { searchSkills } from '#lib/server/catalog.ts';
export const GET = ({ url }: import('./$types').RequestEvent) =>
	json(searchSkills(url.searchParams));
