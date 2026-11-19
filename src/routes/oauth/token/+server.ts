import { json } from '@sveltejs/kit';
import { issueTokens, redeemCode, refreshTokens, resourceId } from '#lib/server/oauth.ts';
import { allowAttempt } from '#lib/server/auth.ts';
import { appRoot } from '#lib/server/paths.ts';

const fail = (error: string, status = 400) => json({ error }, { status });

export const POST = async ({ request, url, getClientAddress }: import('./$types').RequestEvent) => {
	if (!allowAttempt(`token:${getClientAddress()}`, 60)) return fail('slow_down', 429);
	const form = new URLSearchParams(await request.text());
	const clientId = form.get('client_id') || '';
	const grant = form.get('grant_type');
	try {
		if (grant === 'refresh_token') {
			const refresh = form.get('refresh_token') || '';
			if (!refresh || !clientId) return fail('invalid_request');
			return json(refreshTokens(refresh, clientId));
		}
		if (grant === 'authorization_code') {
			const code = form.get('code') || '';
			const verifier = form.get('code_verifier') || '';
			const redirectUri = form.get('redirect_uri') || '';
			if (!code || !verifier || !redirectUri || !clientId) return fail('invalid_request');
			const granted = redeemCode(code, clientId, redirectUri, verifier);
			const resource = form.get('resource');
			// RFC 8707: a token is only ever minted for this server's own resource.
			if (
				resource &&
				resource.replace(/\/$/, '') !==
					resourceId(url.origin, appRoot === '/' ? '' : appRoot).replace(/\/$/, '')
			)
				return fail('invalid_target');
			return json(issueTokens(clientId, granted.userId, granted.scopes, granted.resource));
		}
		return fail('unsupported_grant_type');
	} catch {
		// Never distinguish an unknown code from a mismatched verifier or client.
		return fail('invalid_grant');
	}
};
