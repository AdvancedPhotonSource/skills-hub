import { beforeAll, describe, expect, it } from 'vitest';
import { createHash, randomBytes } from 'node:crypto';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const directory = mkdtempSync(join(tmpdir(), 'aps-hub-oauth-'));
process.env.DATA_DIR = directory;
const { register } = await import('../src/lib/server/auth');
const { verifyAccessToken } = await import('../src/lib/server/mcp-auth');
const {
	registerClient,
	validateAuthorize,
	storePending,
	peekPending,
	consumePending,
	issueCode,
	redeemCode,
	issueTokens,
	refreshTokens,
	protectedResourceMetadata,
	authorizationServerMetadata,
	resourceId
} = await import('../src/lib/server/oauth');

const origin = 'https://hub.test';
const resource = resourceId(origin, '');
const redirectUri = 'http://127.0.0.1:52100/callback';
let user: Awaited<ReturnType<typeof register>>;
let clientId: string;

const verifier = () => randomBytes(32).toString('base64url');
const challengeFor = (v: string) => createHash('sha256').update(v).digest('base64url');
const query = (overrides: Record<string, string> = {}, challenge = challengeFor('v')) =>
	new URLSearchParams({
		client_id: clientId,
		redirect_uri: redirectUri,
		response_type: 'code',
		code_challenge_method: 'S256',
		code_challenge: challenge,
		resource,
		...overrides
	});

beforeAll(async () => {
	user = await register('oauth-user', 'long-passphrase-for-oauth-user', 'OAuth User');
	clientId = registerClient({ redirect_uris: [redirectUri], client_name: 'Test Agent' }).client_id;
});

describe('discovery documents', () => {
	it('names this server as its own resource and authorization server', () => {
		const prm = protectedResourceMetadata(origin, '');
		expect(prm.resource).toBe(`${origin}/mcp`);
		expect(prm.authorization_servers).toEqual([origin]);
		expect(prm.scopes_supported).toContain('catalog:read');
		const asm = authorizationServerMetadata(origin, '');
		expect(asm.issuer).toBe(origin);
		expect(asm.code_challenge_methods_supported).toEqual(['S256']);
		expect(asm.authorization_response_iss_parameter_supported).toBe(true);
		expect(asm.token_endpoint).toBe(`${origin}/oauth/token`);
	});
});

describe('client registration', () => {
	it('accepts https and loopback redirects and refuses anything else', () => {
		expect(registerClient({ redirect_uris: ['https://agent.example/cb'] }).client_id).toBeTruthy();
		for (const bad of [
			[],
			['javascript:alert(1)'],
			['http://evil.example/cb'],
			['https://agent.example/cb#frag'],
			['https://user:pw@agent.example/cb']
		])
			expect(() => registerClient({ redirect_uris: bad })).toThrow();
	});
});

describe('authorization requests', () => {
	it('refuses an unknown client, an unregistered redirect, weak PKCE or a foreign resource', () => {
		expect(() => validateAuthorize(query({ client_id: 'nope' }), resource)).toThrow(
			/Unknown client/
		);
		expect(() =>
			validateAuthorize(query({ redirect_uri: 'https://evil.test/cb' }), resource)
		).toThrow(/redirect_uri/);
		expect(() => validateAuthorize(query({ code_challenge_method: 'plain' }), resource)).toThrow(
			/S256/
		);
		expect(() => validateAuthorize(query({ code_challenge: 'short' }), resource)).toThrow(
			/code_challenge/
		);
		expect(() => validateAuthorize(query({ response_type: 'token' }), resource)).toThrow();
		expect(() =>
			validateAuthorize(query({ resource: 'https://elsewhere.test/mcp' }), resource)
		).toThrow(/resource parameter/);
		expect(() =>
			validateAuthorize(query({ scope: 'catalog:read admin:everything' }), resource)
		).toThrow(/Unsupported scope/);
	});

	it('defaults to the supported scopes and survives the sign-in round trip', () => {
		const request = validateAuthorize(query(), resource);
		expect(request.scopes).toEqual(['catalog:read', 'skills:download']);
		const id = storePending(request);
		// Peeking must not consume: the person is still being sent through Entra.
		expect(peekPending(id)?.clientName).toBe('Test Agent');
		expect(peekPending(id)?.clientName).toBe('Test Agent');
		expect(consumePending(id)?.clientName).toBe('Test Agent');
		expect(peekPending(id)).toBeNull();
		expect(peekPending('no-such-id')).toBeNull();
	});
});

describe('code exchange', () => {
	it('issues a token only for the matching verifier, client and redirect', () => {
		const v = verifier();
		const request = validateAuthorize(query({}, challengeFor(v)), resource);
		const code = issueCode(request, user.id);
		expect(() => redeemCode(code, clientId, redirectUri, 'wrong-verifier')).toThrow();
		expect(() => redeemCode(code, 'another-client', redirectUri, v)).toThrow();
		expect(() => redeemCode(code, clientId, 'https://evil.test/cb', v)).toThrow();
		const granted = redeemCode(code, clientId, redirectUri, v);
		expect(granted.userId).toBe(user.id);
		expect(granted.resource).toBe(resource);
	});

	it('burns the code on first use', () => {
		const v = verifier();
		const code = issueCode(validateAuthorize(query({}, challengeFor(v)), resource), user.id);
		expect(redeemCode(code, clientId, redirectUri, v).userId).toBe(user.id);
		expect(() => redeemCode(code, clientId, redirectUri, v)).toThrow();
	});
});

describe('access and refresh tokens', () => {
	it('mints a working access token bound to this resource', () => {
		const tokens = issueTokens(clientId, user.id, ['catalog:read'], resource) as {
			access_token: string;
			refresh_token: string;
			expires_in: number;
			scope: string;
		};
		expect(tokens.scope).toBe('catalog:read');
		expect(tokens.expires_in).toBeGreaterThan(0);
		const verified = verifyAccessToken(tokens.access_token, resource);
		expect(verified?.user.id).toBe(user.id);
		expect(verified?.scopes).toEqual(['catalog:read']);
		// RFC 8707: the same token is refused when presented for another resource.
		expect(verifyAccessToken(tokens.access_token, 'https://elsewhere.test/mcp')).toBeNull();
	});

	it('rotates refresh tokens and refuses the spent one or a foreign client', () => {
		const first = issueTokens(clientId, user.id, ['catalog:read'], resource) as {
			refresh_token: string;
		};
		expect(() => refreshTokens(first.refresh_token, 'another-client')).toThrow();
		const second = refreshTokens(first.refresh_token, clientId) as {
			access_token: string;
			refresh_token: string;
		};
		expect(verifyAccessToken(second.access_token, resource)?.user.id).toBe(user.id);
		expect(second.refresh_token).not.toBe(first.refresh_token);
		expect(() => refreshTokens(first.refresh_token, clientId)).toThrow();
	});
});
