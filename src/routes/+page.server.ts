import { searchSkills, taxonomyCounts } from '$lib/server/catalog';

export const load = ({ url }: import('./$types').PageServerLoadEvent) => ({
	...searchSkills(url.searchParams),
	taxonomy: taxonomyCounts(),
	filters: Object.fromEntries(url.searchParams)
});
