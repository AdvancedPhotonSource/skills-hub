import { redirect } from '@sveltejs/kit';
import { resolve } from '$app/paths';
import { revokeSession, sessionCookie } from '#lib/server/auth.ts';
import { appRoot } from '#lib/server/paths.ts';

export const POST = ({ cookies }: import('./$types').RequestEvent) => {
	revokeSession(cookies.get(sessionCookie));
	cookies.delete(sessionCookie, { path: appRoot });
	redirect(303, resolve('/'));
};
