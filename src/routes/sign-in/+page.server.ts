import { fail, redirect } from '@sveltejs/kit';
import { base } from '$app/paths';
import {
	authenticate,
	allowAttempt,
	createSession,
	sessionCookie,
	sessionLifetime
} from '$lib/server/auth';

export const load = ({ locals }: import('./$types').PageServerLoadEvent) => {
	if (locals.user) redirect(303, `${base}/my-skills`);
};
export const actions = {
	default: async ({ request, cookies, url, getClientAddress }: import('./$types').RequestEvent) => {
		const form = await request.formData();
		const username = String(form.get('username') || '').slice(0, 100);
		if (
			!allowAttempt(`login-ip:${getClientAddress()}`, 50) ||
			!allowAttempt(`login-user:${username.trim().toLowerCase()}`, 10)
		)
			return fail(429, { message: 'Too many sign-in attempts. Try again in 15 minutes.' });
		const user = await authenticate(username, String(form.get('password') || ''));
		if (!user) return fail(400, { message: 'Username or password is incorrect.' });
		cookies.set(sessionCookie, createSession(user.id), {
			path: base || '/',
			httpOnly: true,
			sameSite: 'lax',
			secure: url.protocol === 'https:',
			maxAge: sessionLifetime
		});
		redirect(303, `${base}/my-skills`);
	}
};
