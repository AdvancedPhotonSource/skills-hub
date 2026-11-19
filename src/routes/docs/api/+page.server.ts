import { searchSkills } from '#lib/server/catalog.ts';

export const load = () => {
	const skill = searchSkills(new URLSearchParams()).skills[0];
	return { exampleId: skill?.id || '', exampleName: skill?.name || '' };
};
