import { redirect } from '@sveltejs/kit';
import { base } from '$app/paths';
import { entraIdentity } from '$lib/server/entra';

export const load = ({ locals }: import('./$types').PageServerLoadEvent) => {
	if (!locals.user) redirect(303, `${base}/sign-in`);
	return { account: locals.user, entra: entraIdentity(locals.user.id) ?? null };
};
