import { redirect } from '@sveltejs/kit';
import { base } from '$app/paths';
import { editorActions } from '$lib/server/editor';
export const load = ({ locals }: import('./$types').PageServerLoadEvent) => {
	if (!locals.user) redirect(303, `${base}/sign-in`);
};
export const actions = { preview: editorActions.preview, publish: editorActions.publish };
