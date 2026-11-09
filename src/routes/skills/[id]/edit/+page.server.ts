import { error, redirect } from '@sveltejs/kit';
import { base } from '$app/paths';
import { requireOwner } from '$lib/server/catalog';
import { editorActions } from '$lib/server/editor';
import { HubError } from '$lib/server/errors';
import { db } from '$lib/server/db';
import type { Owner } from '$lib/types';
export const load = ({ locals, params }: import('./$types').PageServerLoadEvent) => {
	if (!locals.user) redirect(303, `${base}/sign-in`);
	try {
		const skill = requireOwner(params.id, locals.user);
		return {
			skill,
			ownerChoices: db
				.prepare(
					'SELECT id, username, display_name AS displayName FROM users ORDER BY display_name, id'
				)
				.all() as Owner[]
		};
	} catch (e) {
		if (e instanceof HubError) error(e.status, e.message);
		throw e;
	}
};
export const actions = editorActions;
