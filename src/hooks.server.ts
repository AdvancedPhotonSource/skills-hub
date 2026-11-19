import { error } from '@sveltejs/kit';
import type { Handle } from '@sveltejs/kit/hooks';
import { resolve as resolvePath } from '$app/paths';
import { dev } from '$app/env';
import { sessionCookie, sessionUser } from '#lib/server/auth.ts';
import { grantParam } from '#lib/server/grants.ts';
import { mcpEnabled } from '#lib/server/mcp-auth.ts';
import { appRoot } from '#lib/server/paths.ts';

// Only authentication routes are public. All other requests fail closed, including
// JSON/data requests, files and downloads. This never depends on client-side state.
const publicRoutes = new Set([
	'/sign-in',
	'/auth/entra',
	'/auth/callback/entra',
	'/sign-out',
	'/register',
	// The OAuth surface. A client reads the two discovery documents and registers
	// before it can hold any token, and redeems a code at /oauth/token without a
	// cookie, so these cannot sit behind the session gate. None of them expose
	// catalog content: /oauth/authorize requires an SSO session before it shows
	// anything, and the rest deal only in endpoints, scopes and PKCE-bound codes.
	'/.well-known/oauth-protected-resource',
	'/.well-known/oauth-authorization-server',
	'/oauth/register',
	'/oauth/token',
	'/oauth/authorize'
]);
// Endpoints spoken by non-browser clients, which send no Origin header. Each
// authenticates by bearer token or PKCE rather than by cookie, so the CSRF
// check the header provides is not what protects them. The consent form at
// /oauth/authorize is a real browser form and keeps the check.
const crossClientRoutes = new Set(['/mcp', '/oauth/token', '/oauth/register']);

export const handle: Handle = async ({ event, resolve }) => {
	// Defence in depth for GHSA-pfhg-q3qv-9q6r (protocol-relative form actions),
	// fixed upstream in SvelteKit 3 but kept so the rejection stays explicit.
	if (event.url.pathname.startsWith('//')) error(400, 'Invalid request path.');
	// Applies to form actions and JSON endpoints, including unauthenticated writes.
	// /mcp is exempt from the origin check only: it is bearer-authenticated and never
	// reads cookies, so it cannot be driven by a browser's ambient credentials, and
	// MCP clients are not browsers and send no Origin header. The size limit still applies.
	if (!['GET', 'HEAD', 'OPTIONS'].includes(event.request.method)) {
		if (
			!crossClientRoutes.has(event.route.id || '') &&
			event.request.headers.get('origin') !== event.url.origin
		)
			error(403, 'Request origin does not match this site.');
		const length = Number(event.request.headers.get('content-length') || 0);
		if (length > 12 * 1024 * 1024) error(413, 'Upload must be smaller than 12 MB.');
	}
	event.locals.user = sessionUser(event.cookies.get(sessionCookie), 'entra');

	if (!event.locals.user && event.cookies.get(sessionCookie))
		event.cookies.delete(sessionCookie, { path: appRoot });

	// The download route authenticates itself instead of using the session cookie. It
	// does not widen access: it resolves its grant to a user and rejects an invalid one.
	const grantedDownload =
		event.route.id === '/skills/[id]/download' &&
		['GET', 'HEAD'].includes(event.request.method) &&
		Boolean(event.url.searchParams.get(grantParam));
	const mcpRequest = mcpEnabled && event.route.id === '/mcp';

	let response: Response;
	if (
		!event.locals.user &&
		!grantedDownload &&
		!mcpRequest &&
		!publicRoutes.has(event.route.id || '')
	) {
		const navigation =
			!event.isDataRequest &&
			['GET', 'HEAD'].includes(event.request.method) &&
			event.request.headers.get('accept')?.includes('text/html');
		response = navigation
			? new Response(null, { status: 303, headers: { Location: resolvePath('/sign-in') } })
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
