import { error, redirect } from '@sveltejs/kit';
import { base } from '$app/paths';
import { requireOwner } from '$lib/server/catalog';
import { editorActions } from '$lib/server/editor';
import { HubError } from '$lib/server/errors';
export const load = ({ locals, params }: import('./$types').PageServerLoadEvent) => {
	if (!locals.user) redirect(303, `${base}/sign-in`);
	try {
		return { skill: requireOwner(params.id, locals.user) };
	} catch (e) {
		if (e instanceof HubError) error(e.status, e.message);
		throw e;
	}
};
export const actions = editorActions;
