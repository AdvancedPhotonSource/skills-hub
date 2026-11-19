import { resolve } from '$app/paths';
import { redirect } from '@sveltejs/kit';
import { createSession, revokeSession, sessionCookie, sessionLifetime } from '#lib/server/auth.ts';
import { entraCookie, finishEntraSignIn } from '#lib/server/entra.ts';
import { appRoot, authRoot } from '#lib/server/paths.ts';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ cookies, url, locals }) => {
	const token = cookies.get(entraCookie);
	cookies.delete(entraCookie, { path: authRoot });
	let destination: string = resolve('/my-skills');
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

		if (locals.user?.id === user.id) destination = resolve('/account');

		revokeSession(cookies.get(sessionCookie));
		cookies.set(sessionCookie, createSession(user.id, 'entra'), {
			path: appRoot,
			httpOnly: true,
			sameSite: 'lax',
			secure: url.protocol === 'https:',
			maxAge: sessionLifetime
		});
	} catch {
		// Never expose authorization codes, tokens, secrets or provider error details.
		destination = `${resolve(locals.user ? '/account' : '/sign-in')}?sso=failed`;
	}
	redirect(303, destination);
};
