import { base } from '$app/paths';
import { dev } from '$app/environment';
import { error, type Handle } from '@sveltejs/kit';
import { sessionCookie, sessionUser } from '$lib/server/auth';

export const handle: Handle = async ({ event, resolve }) => {
	// Applies to form actions and JSON endpoints, including unauthenticated writes.
	if (!['GET', 'HEAD', 'OPTIONS'].includes(event.request.method)) {
		if (event.request.headers.get('origin') !== event.url.origin)
			error(403, 'Request origin does not match this site.');
		const length = Number(event.request.headers.get('content-length') || 0);
		if (length > 12 * 1024 * 1024) error(413, 'Upload must be smaller than 12 MB.');
	}
	event.locals.user = sessionUser(event.cookies.get(sessionCookie));
	if (!event.locals.user && event.cookies.get(sessionCookie))
		event.cookies.delete(sessionCookie, { path: base || '/' });
	const response = await resolve(event);
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
