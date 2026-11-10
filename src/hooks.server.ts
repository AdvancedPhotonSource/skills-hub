import { base } from '$app/paths';
import { dev } from '$app/environment';
import { error, type Handle } from '@sveltejs/kit';
import { sessionCookie, sessionUser } from '$lib/server/auth';

// Only authentication routes are public. All other requests fail closed, including
// JSON/data requests, files and downloads. This never depends on client-side state.
const publicRoutes = new Set([
	'/sign-in',
	'/auth/entra',
	'/auth/callback/entra',
	'/sign-out',
	'/register'
]);

export const handle: Handle = async ({ event, resolve }) => {
	// SvelteKit 2 workaround for GHSA-pfhg-q3qv-9q6r (protocol-relative form actions).
	if (event.url.pathname.startsWith('//')) error(400, 'Invalid request path.');
	// Applies to form actions and JSON endpoints, including unauthenticated writes.
	if (!['GET', 'HEAD', 'OPTIONS'].includes(event.request.method)) {
		if (event.request.headers.get('origin') !== event.url.origin)
			error(403, 'Request origin does not match this site.');
		const length = Number(event.request.headers.get('content-length') || 0);
		if (length > 12 * 1024 * 1024) error(413, 'Upload must be smaller than 12 MB.');
	}
	event.locals.user = sessionUser(event.cookies.get(sessionCookie), 'entra');
	if (!event.locals.user && event.cookies.get(sessionCookie))
		event.cookies.delete(sessionCookie, { path: base || '/' });
	let response: Response;
	if (!event.locals.user && !publicRoutes.has(event.route.id || '')) {
		const navigation =
			!event.isDataRequest &&
			['GET', 'HEAD'].includes(event.request.method) &&
			event.request.headers.get('accept')?.includes('text/html');
		response = navigation
			? new Response(null, { status: 303, headers: { Location: `${base}/sign-in` } })
			: Response.json({ error: 'Argonne SSO sign-in is required.' }, { status: 401 });
	} else {
		response = await resolve(event);
	}
	response.headers.set('X-Content-Type-Options', 'nosniff');
	response.headers.set('Referrer-Policy', 'same-origin');
	response.headers.set('X-Frame-Options', 'DENY');
	response.headers.set(
		'Content-Security-Policy',
		`frame-ancestors 'none'; object-src 'none'; base-uri 'self'; img-src 'self' data:;${dev ? '' : " form-action 'self';"}`
	);
	response.headers.set('Cache-Control', 'private, no-store');
	return response;
};
