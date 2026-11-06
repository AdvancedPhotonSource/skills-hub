import { error, redirect } from '@sveltejs/kit';
import { base } from '$app/paths';
import { entraEnabled } from '$lib/server/entra';

export const load = ({ locals, url }: import('./$types').PageServerLoadEvent) => {
	if (locals.user) redirect(303, `${base}/my-skills`);
	return {
		entraEnabled: entraEnabled(),
		ssoError:
			url.searchParams.get('sso') === 'failed'
				? 'Argonne sign-in could not be completed. Please try again. If this continues, contact the hub administrator.'
				: null
	};
};

export const actions = {
	default: () => error(403, 'Use Argonne SSO to sign in. Local-password sign-in is disabled.')
};
