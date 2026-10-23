import { fail, redirect } from '@sveltejs/kit';
import { base } from '$app/paths';
import {
	allowAttempt,
	authenticate,
	resetPassword,
	createSession,
	sessionCookie,
	sessionLifetime
} from '$lib/server/auth';
import { formError } from '$lib/server/forms';

export const load = ({ locals }: import('./$types').PageServerLoadEvent) => {
	if (!locals.user) redirect(303, `${base}/sign-in`);
	return { account: locals.user };
};
export const actions = {
	default: async ({ locals, request, cookies, url }: import('./$types').RequestEvent) => {
		if (!locals.user) redirect(303, `${base}/sign-in`);
		if (!allowAttempt(`password:${locals.user.id}`))
			return fail(429, { message: 'Too many attempts. Try again in 15 minutes.' });
		const form = await request.formData();
		if (!(await authenticate(locals.user.username, String(form.get('currentPassword') || ''))))
			return fail(400, { message: 'Current password is incorrect.' });
		try {
			await resetPassword(locals.user.id, String(form.get('password') || ''));
		} catch (error) {
			return formError(error);
		}
		cookies.set(sessionCookie, createSession(locals.user.id), {
			path: base || '/',
			httpOnly: true,
			sameSite: 'lax',
			secure: url.protocol === 'https:',
			maxAge: sessionLifetime
		});
		return { success: true };
	}
};
