import { error, redirect } from '@sveltejs/kit';
import { resolve } from '$app/paths';
import {
	consumePending,
	issueCode,
	issuer,
	peekPending,
	pendingCookie,
	pendingLifetime,
	resourceId,
	storePending,
	validateAuthorize
} from '#lib/server/oauth.ts';
import { appRoot } from '#lib/server/paths.ts';
import { HubError } from '#lib/server/errors.ts';

const base = () => (appRoot === '/' ? '' : appRoot);
const scopeLabels: Record<string, string> = {
	'catalog:read': 'Search the catalogue and read entry files',
	'skills:download': 'Download skills and MCPs on your behalf'
};

export const load = ({ url, cookies, locals }: import('./$types').PageServerLoadEvent) => {
	const resuming = url.searchParams.get('resume') === '1';
	let request = resuming ? peekPending(cookies.get(pendingCookie)) : null;
	if (resuming && !request)
		error(400, 'This authorization request expired. Start again from your agent.');
	if (!request) {
		try {
			request = validateAuthorize(url.searchParams, resourceId(url.origin, base()));
		} catch (e) {
			// Invalid client or redirect_uri is never redirected back: that would make
			// this endpoint an open redirector. The person sees the failure instead.
			if (e instanceof HubError) error(e.status, e.message);
			throw e;
		}
		cookies.set(pendingCookie, storePending(request), {
			path: appRoot,
			httpOnly: true,
			sameSite: 'lax',
			secure: url.protocol === 'https:',
			maxAge: Math.floor(pendingLifetime / 1000)
		});
	}
	// Argonne SSO is the only way to establish who is approving. The pending request
	// is already stored, so the Entra callback can bring them back here.
	if (!locals.user) redirect(303, resolve('/sign-in'));
	return {
		clientName: request.clientName,
		scopes: request.scopes.map((scope) => ({ id: scope, label: scopeLabels[scope] || scope })),
		account: locals.user.displayName
	};
};

const settle = (
	cookies: import('@sveltejs/kit').Cookies,
	url: URL,
	decide: (request: NonNullable<ReturnType<typeof peekPending>>) => URL
) => {
	const request = consumePending(cookies.get(pendingCookie));
	cookies.delete(pendingCookie, { path: appRoot });
	if (!request) error(400, 'This authorization request expired. Start again from your agent.');
	const target = decide(request);
	if (request.state) target.searchParams.set('state', request.state);
	// RFC 9207: name the issuer so the client can detect a mix-up attack.
	target.searchParams.set('iss', issuer(url.origin));
	// Only ever an origin the client registered and validateAuthorize matched, so
	// the allowlist is the redirect target itself rather than a blanket exemption.
	redirect(303, target.href, { external: [target.origin] });
};

export const actions = {
	approve: ({ cookies, url, locals }: import('./$types').RequestEvent) => {
		if (!locals.user) error(401, 'Sign in to approve this request.');
		settle(cookies, url, (request) => {
			const target = new URL(request.redirectUri);
			target.searchParams.set('code', issueCode(request, locals.user!.id));
			return target;
		});
	},
	deny: ({ cookies, url }: import('./$types').RequestEvent) =>
		settle(cookies, url, (request) => {
			const target = new URL(request.redirectUri);
			target.searchParams.set('error', 'access_denied');
			return target;
		})
};
