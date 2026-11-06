import { error, redirect } from '@sveltejs/kit';
import { base } from '$app/paths';

export const load = () => redirect(303, `${base}/sign-in`);
export const actions = {
	default: () => error(403, 'Accounts are created through Argonne SSO.')
};
