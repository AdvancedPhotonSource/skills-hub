import { createHash, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import { db } from './db';
import { HubError } from './errors';
import { mcpScopes } from './mcp-auth';

/**
 * A small OAuth 2.1 authorization server, scoped to what the MCP specification
 * requires of this hub and nothing more: authorization code with PKCE (S256
 * only), refresh tokens, dynamic client registration, RFC 8707 resource
 * binding and RFC 9207 issuer identification.
 *
 * Argonne Entra remains the only identity provider. This server never
 * authenticates anyone itself: /oauth/authorize requires an existing SSO
 * session and federates to Entra when there is none. It only decides which
 * client may act for an already-signed-in user, and for how long.
 */
const digest = (value: string) => createHash('sha256').update(value).digest('hex');
export const accessLifetime = 60 * 60 * 1000;
export const refreshLifetime = 30 * 24 * 60 * 60 * 1000;
const codeLifetime = 60 * 1000;
export const pendingLifetime = 15 * 60 * 1000;
export const pendingCookie = 'aps_oauth_continue';

export const issuer = (origin: string) => origin;
export const resourceId = (origin: string, base: string) => `${origin}${base}/mcp`;
export const metadataUrl = (origin: string) => `${origin}/.well-known/oauth-protected-resource`;

export function protectedResourceMetadata(origin: string, base: string) {
	return {
		resource: resourceId(origin, base),
		authorization_servers: [issuer(origin)],
		scopes_supported: [...mcpScopes],
		bearer_methods_supported: ['header'],
		resource_documentation: `${origin}${base}/docs/api`
	};
}

export function authorizationServerMetadata(origin: string, base: string) {
	const at = (path: string) => `${origin}${base}${path}`;
	return {
		issuer: issuer(origin),
		authorization_endpoint: at('/oauth/authorize'),
		token_endpoint: at('/oauth/token'),
		registration_endpoint: at('/oauth/register'),
		scopes_supported: [...mcpScopes],
		response_types_supported: ['code'],
		response_modes_supported: ['query'],
		grant_types_supported: ['authorization_code', 'refresh_token'],
		token_endpoint_auth_methods_supported: ['none'],
		code_challenge_methods_supported: ['S256'],
		authorization_response_iss_parameter_supported: true
	};
}

/** Loopback and https only, no fragment or credentials: RFC 8252 for native clients. */
function usableRedirect(value: string) {
	let url: URL;
	try {
		url = new URL(value);
	} catch {
		return false;
	}
	const loopback =
		url.protocol === 'http:' && ['127.0.0.1', '[::1]', 'localhost'].includes(url.hostname);
	return (url.protocol === 'https:' || loopback) && !url.hash && !url.username && !url.password;
}

export function registerClient(metadata: Record<string, unknown>) {
	const uris = Array.isArray(metadata.redirect_uris) ? metadata.redirect_uris.map(String) : [];
	if (!uris.length || uris.length > 10 || !uris.every(usableRedirect))
		throw new HubError('redirect_uris must be one to ten https or loopback URIs.');
	const name = String(metadata.client_name || 'Unnamed client').slice(0, 120);
	const clientId = randomUUID();
	db.prepare('DELETE FROM oauth_clients WHERE created_at < ?').run(
		new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString()
	);
	db.prepare('INSERT INTO oauth_clients (client_id, name, redirect_uris) VALUES (?, ?, ?)').run(
		clientId,
		name,
		JSON.stringify(uris)
	);
	return {
		client_id: clientId,
		client_name: name,
		redirect_uris: uris,
		token_endpoint_auth_method: 'none',
		grant_types: ['authorization_code', 'refresh_token'],
		response_types: ['code']
	};
}

export const clientById = (clientId: string) =>
	db
		.prepare('SELECT client_id, name, redirect_uris FROM oauth_clients WHERE client_id = ?')
		.get(clientId) as { client_id: string; name: string; redirect_uris: string } | undefined;

export type AuthorizeRequest = {
	clientId: string;
	clientName: string;
	redirectUri: string;
	scopes: string[];
	resource: string;
	challenge: string;
	state: string | null;
};

/**
 * Validate an authorization request. Errors here are deliberately NOT redirected
 * back to the caller: an unregistered client or an unregistered redirect_uri is
 * exactly the case where redirecting would turn this endpoint into an open
 * redirector, so the user sees the failure instead.
 */
export function validateAuthorize(params: URLSearchParams, expectedResource: string) {
	const clientId = params.get('client_id') || '';
	const client = clientById(clientId);
	if (!client) throw new HubError('Unknown client. Register before requesting authorization.');
	const redirectUri = params.get('redirect_uri') || '';
	const registered: string[] = JSON.parse(client.redirect_uris);
	if (!registered.includes(redirectUri))
		throw new HubError('redirect_uri does not match a registered URI for this client.');
	if (params.get('response_type') !== 'code')
		throw new HubError('Only the authorization code response type is supported.');
	if (params.get('code_challenge_method') !== 'S256')
		throw new HubError('PKCE with S256 is required.');
	const challenge = params.get('code_challenge') || '';
	if (!/^[A-Za-z0-9_-]{43,128}$/.test(challenge)) throw new HubError('Invalid code_challenge.');
	const resource = params.get('resource') || '';
	if (resource && resource.replace(/\/$/, '') !== expectedResource.replace(/\/$/, ''))
		throw new HubError('The resource parameter does not name this server.');
	const requested = (params.get('scope') || '').split(/\s+/).filter(Boolean);
	const unknown = requested.filter((s) => !mcpScopes.includes(s as (typeof mcpScopes)[number]));
	if (unknown.length) throw new HubError(`Unsupported scope: ${unknown.join(', ')}`);
	return {
		clientId,
		clientName: client.name,
		redirectUri,
		scopes: requested.length ? requested : [...mcpScopes],
		resource: expectedResource,
		challenge,
		state: params.get('state')
	} satisfies AuthorizeRequest;
}

export function storePending(request: AuthorizeRequest) {
	const id = randomUUID();
	db.prepare('DELETE FROM oauth_pending WHERE expires_at <= ?').run(Date.now());
	db.prepare(
		`INSERT INTO oauth_pending (id, client_id, redirect_uri, scopes, resource, challenge, state, expires_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
	).run(
		id,
		request.clientId,
		request.redirectUri,
		JSON.stringify(request.scopes),
		request.resource,
		request.challenge,
		request.state,
		Date.now() + pendingLifetime
	);
	return id;
}

/** Read without consuming: the request must survive the Entra round trip and the consent render. */
export function peekPending(id: string | undefined): AuthorizeRequest | null {
	if (!id) return null;
	const row = db
		.prepare('SELECT * FROM oauth_pending WHERE id = ? AND expires_at > ?')
		.get(id, Date.now()) as
		| {
				client_id: string;
				redirect_uri: string;
				scopes: string;
				resource: string;
				challenge: string;
				state: string | null;
		  }
		| undefined;
	if (!row) return null;
	const client = clientById(row.client_id);
	if (!client) return null;
	return {
		clientId: row.client_id,
		clientName: client.name,
		redirectUri: row.redirect_uri,
		scopes: JSON.parse(row.scopes),
		resource: row.resource,
		challenge: row.challenge,
		state: row.state
	};
}

export function issueCode(request: AuthorizeRequest, userId: string) {
	const code = randomBytes(32).toString('base64url');
	db.prepare('DELETE FROM oauth_codes WHERE expires_at <= ?').run(Date.now());
	db.prepare(
		`INSERT INTO oauth_codes (code_hash, client_id, user_id, redirect_uri, scopes, resource, challenge, expires_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
	).run(
		digest(code),
		request.clientId,
		userId,
		request.redirectUri,
		JSON.stringify(request.scopes),
		request.resource,
		request.challenge,
		Date.now() + codeLifetime
	);
	return code;
}

const matches = (a: string, b: string) => {
	const left = Buffer.from(a);
	const right = Buffer.from(b);
	return left.length === right.length && timingSafeEqual(left, right);
};

/**
 * Single use, but only on success. Deleting before the checks would let anyone
 * holding a stolen code destroy it by presenting a wrong verifier, so the row
 * is validated first and consumed in the same transaction. Codes live 60s.
 */
export function redeemCode(code: string, clientId: string, redirectUri: string, verifier: string) {
	return db.transaction(() => {
		const row = db
			.prepare('SELECT * FROM oauth_codes WHERE code_hash = ? AND expires_at > ?')
			.get(digest(code), Date.now()) as
			| {
					client_id: string;
					user_id: string;
					redirect_uri: string;
					scopes: string;
					resource: string;
					challenge: string;
			  }
			| undefined;
		if (!row) throw new HubError('invalid_grant');
		const derived = createHash('sha256').update(verifier).digest('base64url');
		if (
			!matches(row.client_id, clientId) ||
			!matches(row.redirect_uri, redirectUri) ||
			!matches(row.challenge, derived)
		)
			throw new HubError('invalid_grant');
		db.prepare('DELETE FROM oauth_codes WHERE code_hash = ?').run(digest(code));
		return {
			userId: row.user_id,
			scopes: JSON.parse(row.scopes) as string[],
			resource: row.resource
		};
	})();
}

export function issueTokens(
	clientId: string,
	userId: string,
	scopes: string[],
	resource: string,
	withRefresh = true
) {
	const access = randomBytes(32).toString('base64url');
	const now = Date.now();
	db.prepare('DELETE FROM mcp_tokens WHERE expires_at <= ?').run(now);
	db.prepare(
		`INSERT INTO mcp_tokens (token_hash, user_id, scopes, label, expires_at, client_id, resource)
		VALUES (?, ?, ?, ?, ?, ?, ?)`
	).run(
		digest(access),
		userId,
		JSON.stringify(scopes),
		'oauth',
		now + accessLifetime,
		clientId,
		resource
	);
	const body: Record<string, unknown> = {
		access_token: access,
		token_type: 'Bearer',
		expires_in: Math.floor(accessLifetime / 1000),
		scope: scopes.join(' ')
	};
	if (withRefresh) {
		const refresh = randomBytes(32).toString('base64url');
		db.prepare('DELETE FROM oauth_refresh WHERE expires_at <= ?').run(now);
		db.prepare(
			`INSERT INTO oauth_refresh (token_hash, client_id, user_id, scopes, resource, expires_at)
			VALUES (?, ?, ?, ?, ?, ?)`
		).run(
			digest(refresh),
			clientId,
			userId,
			JSON.stringify(scopes),
			resource,
			now + refreshLifetime
		);
		body.refresh_token = refresh;
	}
	return body;
}

/**
 * Rotating, and consumed only once the client checks out — otherwise a wrong
 * client_id would revoke a valid refresh token for everyone.
 */
export function refreshTokens(refresh: string, clientId: string) {
	return db.transaction(() => {
		const row = db
			.prepare('SELECT * FROM oauth_refresh WHERE token_hash = ? AND expires_at > ?')
			.get(digest(refresh), Date.now()) as
			{ client_id: string; user_id: string; scopes: string; resource: string } | undefined;
		if (!row || !matches(row.client_id, clientId)) throw new HubError('invalid_grant');
		db.prepare('DELETE FROM oauth_refresh WHERE token_hash = ?').run(digest(refresh));
		return issueTokens(row.client_id, row.user_id, JSON.parse(row.scopes), row.resource);
	})();
}

/** Consume on approval or denial, so one authorization request yields one code. */
export function consumePending(id: string | undefined) {
	const request = peekPending(id);
	if (id) db.prepare('DELETE FROM oauth_pending WHERE id = ?').run(id);
	return request;
}
