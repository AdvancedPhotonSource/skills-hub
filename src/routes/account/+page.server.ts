import { redirect } from '@sveltejs/kit';
import { resolve } from '$app/paths';
import { entraIdentity } from '#lib/server/entra.ts';

export const load = ({ locals }: import('./$types').PageServerLoadEvent) => {
	if (!locals.user) redirect(303, resolve(`sign-in`));

	return {
		account: locals.user,
		entra: entraIdentity(locals.user.id) ?? null
	};
};
