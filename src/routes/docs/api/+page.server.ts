import { searchSkills } from '$lib/server/catalog';

export const load = () => {
	const skill = searchSkills(new URLSearchParams()).skills[0];
	return { exampleId: skill?.id || '', exampleName: skill?.name || '' };
};
