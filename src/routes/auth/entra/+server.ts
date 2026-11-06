import { base } from '$app/paths';
import { error, redirect } from '@sveltejs/kit';
import { allowAttempt } from '$lib/server/auth';
import {
	entraCookie,
	entraEnabled,
	entraRequestLifetime,
	startEntraSignIn
} from '$lib/server/entra';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ cookies, url, getClientAddress, locals }) => {
	if (locals.user) redirect(303, `${base}/my-skills`);
	if (!entraEnabled()) error(503, 'Argonne sign-in is not configured.');
	if (!allowAttempt(`entra:${getClientAddress()}`, 30))
		error(429, 'Too many sign-in attempts. Try again in 15 minutes.');
	let authorizationUrl: URL;
	try {
		const result = await startEntraSignIn(cookies.get(entraCookie));
		authorizationUrl = result.authorizationUrl;
		cookies.set(entraCookie, result.token, {
			path: `${base}/auth`,
			httpOnly: true,
			sameSite: 'lax',
			secure: url.protocol === 'https:',
			maxAge: entraRequestLifetime
		});
	} catch {
		error(503, 'Argonne sign-in is temporarily unavailable. Please try again later.');
	}
	redirect(303, authorizationUrl.href);
};
