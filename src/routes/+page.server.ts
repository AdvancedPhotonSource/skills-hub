import { searchSkills, taxonomyCounts } from '$lib/server/catalog';

export const load = ({ url }: import('./$types').PageServerLoadEvent) => {
	const params = new URLSearchParams(url.searchParams);
	params.delete('grouped');
	if (![...params].some(([key, value]) => value && !['sort', 'page'].includes(key)))
		params.set('grouped', '1');
	return {
		...searchSkills(params),
		taxonomy: taxonomyCounts(),
		filters: Object.fromEntries(url.searchParams)
	};
};
