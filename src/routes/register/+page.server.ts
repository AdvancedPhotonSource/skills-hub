import { error, redirect } from '@sveltejs/kit';
import { resolve } from '$app/paths';

export const load = () => redirect(303, resolve(`sign-in`));
export const actions = {
	default: () => error(403, 'Accounts are created through Argonne SSO.')
};
