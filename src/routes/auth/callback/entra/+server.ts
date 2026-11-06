import { base } from '$app/paths';
import { redirect } from '@sveltejs/kit';
import { createSession, revokeSession, sessionCookie, sessionLifetime } from '$lib/server/auth';
import { entraCookie, finishEntraSignIn } from '$lib/server/entra';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ cookies, url, locals }) => {
	const token = cookies.get(entraCookie);
	cookies.delete(entraCookie, { path: `${base}/auth` });
	let destination = `${base}/my-skills`;
	try {
		const user = await finishEntraSignIn(
			url,
			token,
			locals.user
				? {
						userId: locals.user.id,
						sessionToken: cookies.get(sessionCookie) || ''
					}
				: undefined
		);
		if (locals.user?.id === user.id) destination = `${base}/account`;
		revokeSession(cookies.get(sessionCookie));
		cookies.set(sessionCookie, createSession(user.id, 'entra'), {
			path: base || '/',
			httpOnly: true,
			sameSite: 'lax',
			secure: url.protocol === 'https:',
			maxAge: sessionLifetime
		});
	} catch {
		// Never expose authorization codes, tokens, secrets or provider error details.
		destination = `${base}/${locals.user ? 'account' : 'sign-in'}?sso=failed`;
	}
	redirect(303, destination);
};
