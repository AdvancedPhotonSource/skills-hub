import { fail, redirect } from '@sveltejs/kit';
import { base } from '$app/paths';
import {
	register,
	allowAttempt,
	createSession,
	sessionCookie,
	sessionLifetime
} from '$lib/server/auth';
import { formError } from '$lib/server/forms';

export const load = ({ locals }: import('./$types').PageServerLoadEvent) => {
	if (locals.user) redirect(303, `${base}/my-skills`);
};
export const actions = {
	default: async ({ request, cookies, url, getClientAddress }: import('./$types').RequestEvent) => {
		if (!allowAttempt(`register:${getClientAddress()}`, 10, 3600000))
			return fail(429, { message: 'Too many registration attempts. Try again in an hour.' });
		const form = await request.formData();
		let user;
		try {
			user = await register(
				String(form.get('username') || ''),
				String(form.get('password') || ''),
				String(form.get('displayName') || '')
			);
		} catch (error) {
			return formError(error);
		}
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
