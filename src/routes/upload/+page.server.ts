import { redirect } from '@sveltejs/kit';
import { resolve } from '$app/paths';
import { editorActions } from '#lib/server/editor.ts';
import { collectionChoices } from '#lib/server/catalog.ts';
export const load = ({ locals }: import('./$types').PageServerLoadEvent) => {
	if (!locals.user) redirect(303, resolve(`sign-in`));
	return { memberChoices: collectionChoices(locals.user) };
};
export const actions = {
	discover: editorActions.discover,
	preview: editorActions.preview,
	publish: editorActions.publish
};
