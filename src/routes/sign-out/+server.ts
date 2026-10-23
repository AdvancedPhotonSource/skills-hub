import { redirect } from '@sveltejs/kit';
import { base } from '$app/paths';
import { revokeSession, sessionCookie } from '$lib/server/auth';

export const POST = ({ cookies }: import('./$types').RequestEvent) => {
	revokeSession(cookies.get(sessionCookie));
	cookies.delete(sessionCookie, { path: base || '/' });
	redirect(303, `${base}/`);
};
