import { redirect } from '@sveltejs/kit';
import { base } from '$app/paths';
import { editorActions } from '$lib/server/editor';
import { collectionChoices } from '$lib/server/catalog';
export const load = ({ locals }: import('./$types').PageServerLoadEvent) => {
	if (!locals.user) redirect(303, `${base}/sign-in`);
	return { memberChoices: collectionChoices(locals.user) };
};
export const actions = {
	discover: editorActions.discover,
	preview: editorActions.preview,
	publish: editorActions.publish
};
