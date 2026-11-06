import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { createHash, generateKeyPairSync, sign } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const { transport } = vi.hoisted(() => ({
	transport: vi.fn<import('openid-client').CustomFetch>()
}));
vi.mock('openid-client', async (importOriginal) => {
	const actual = await importOriginal<typeof import('openid-client')>();
	return {
		...actual,
		discovery: (server: URL, clientId: string, secret: string) =>
			actual.discovery(server, clientId, secret, undefined, { [actual.customFetch]: transport })
	};
});

const directory = mkdtempSync(join(tmpdir(), 'aps-entra-test-'));
vi.stubEnv('DATA_DIR', directory);
vi.stubEnv('ENTRA_CLIENT_ID', 'test-client');
vi.stubEnv('ENTRA_CLIENT_SECRET', 'test-secret');
vi.stubEnv('ENTRA_TENANT_ID', '0cfca185-25f7-49e3-8ae7-704d5326e285');
vi.stubEnv('ENTRA_REDIRECT_URI', 'https://hub.example/auth/callback/entra');
const { db } = await import('../src/lib/server/db');
const { register, createSession, sessionUser, revokeSession } =
	await import('../src/lib/server/auth');
const { startEntraSignIn, finishEntraSignIn, linkEntraIdentity, entraIdentity, entraEnabled } =
	await import('../src/lib/server/entra');

const tenant = process.env.ENTRA_TENANT_ID!;
const issuer = `https://login.microsoftonline.com/${tenant}/v2.0`;
const tokenEndpoint = `https://login.microsoftonline.com/${tenant}/oauth2/v2.0/token`;
const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const wrongKey = generateKeyPairSync('rsa', { modulusLength: 2048 }).privateKey;
const jwk = { ...publicKey.export({ format: 'jwk' }), kid: 'test-key', use: 'sig', alg: 'RS256' };
let claims: Record<string, unknown>;
let badSignature: boolean;
let tokenRequests: URLSearchParams[];

function jwt() {
	const head = Buffer.from(JSON.stringify({ alg: 'RS256', kid: 'test-key' })).toString('base64url');
	const payload = Buffer.from(JSON.stringify(claims)).toString('base64url');
	const input = `${head}.${payload}`;
	return `${input}.${sign('RSA-SHA256', Buffer.from(input), badSignature ? wrongKey : privateKey).toString('base64url')}`;
}

beforeEach(() => {
	claims = {
		iss: issuer,
		aud: 'test-client',
		sub: 'pairwise-subject',
		tid: tenant,
		oid: '11111111-1111-4111-8111-111111111111',
		name: 'ANL Scientist',
		preferred_username: 'scientist@anl.gov',
		email: 'scientist@anl.gov',
		iat: Math.floor(Date.now() / 1000),
		exp: Math.floor(Date.now() / 1000) + 3600
	};
	badSignature = false;
	tokenRequests = [];
	transport.mockImplementation(async (input, options) => {
		const url = String(input);
		if (url.endsWith('/.well-known/openid-configuration'))
			return Response.json({
				issuer,
				authorization_endpoint: `https://login.microsoftonline.com/${tenant}/oauth2/v2.0/authorize`,
				token_endpoint: tokenEndpoint,
				jwks_uri: 'https://login.microsoftonline.com/keys',
				response_types_supported: ['code'],
				subject_types_supported: ['public'],
				id_token_signing_alg_values_supported: ['RS256']
			});
		if (url === 'https://login.microsoftonline.com/keys') return Response.json({ keys: [jwk] });
		if (url === tokenEndpoint) {
			tokenRequests.push(new URLSearchParams(String(options?.body)));
			return Response.json({ access_token: 'unused', token_type: 'Bearer', id_token: jwt() });
		}
		throw new Error(`Unexpected request: ${url}`);
	});
});

afterAll(() => {
	db.close();
	rmSync(directory, { recursive: true, force: true });
	vi.unstubAllEnvs();
});

async function begin(link?: { userId: string; sessionToken: string }) {
	const request = await startEntraSignIn(undefined, link);
	claims.nonce = request.authorizationUrl.searchParams.get('nonce');
	const callback = new URL(process.env.ENTRA_REDIRECT_URI!);
	callback.searchParams.set('code', 'authorization-code');
	callback.searchParams.set('state', request.authorizationUrl.searchParams.get('state')!);
	return { ...request, callback };
}

describe('Entra authorization code flow', () => {
	it('uses tenant discovery, PKCE, nonce, state, and the exact registered callback', async () => {
		const request = await begin();
		const parameters = request.authorizationUrl.searchParams;
		expect(parameters.get('scope')).toBe('openid profile email');
		expect(parameters.get('response_type')).toBe('code');
		expect(parameters.get('response_mode')).toBe('query');
		expect(parameters.get('redirect_uri')).toBe(process.env.ENTRA_REDIRECT_URI);
		expect(parameters.get('code_challenge_method')).toBe('S256');
		expect(
			db.prepare('SELECT 1 FROM oidc_requests WHERE token_hash = ?').get(request.token)
		).toBeUndefined();
		const user = await finishEntraSignIn(request.callback, request.token);
		expect(user.username).toBe('scientist');
		expect(user.isAdmin).toBe(false);
		expect(user.verified).toBe(false);
		expect(entraIdentity(user.id)).toEqual({
			subject: `${tenant}:${claims.oid}`,
			username: 'scientist@anl.gov',
			email: 'scientist@anl.gov'
		});
		expect(sessionUser(createSession(user.id))?.id).toBe(user.id);
		const exchange = tokenRequests[0];
		expect(exchange.get('redirect_uri')).toBe(process.env.ENTRA_REDIRECT_URI);
		expect(exchange.get('client_secret')).toBe('test-secret');
		expect(createHash('sha256').update(exchange.get('code_verifier')!).digest('base64url')).toBe(
			parameters.get('code_challenge')
		);
		await expect(finishEntraSignIn(request.callback, request.token)).rejects.toThrow();
	});

	it('retains the same Hub user after Argonne profile claims change', async () => {
		const first = await begin();
		const original = await finishEntraSignIn(first.callback, first.token);
		const second = await begin();
		claims.preferred_username = 'renamed@anl.gov';
		claims.email = 'renamed@anl.gov';
		const current = await finishEntraSignIn(second.callback, second.token);
		expect(current.id).toBe(original.id);
		expect(current.username).toBe(original.username);
		expect(entraIdentity(current.id)?.username).toBe('renamed@anl.gov');
	});

	it('does not merge an existing account based on matching username or email', async () => {
		const local = await register('collision', 'a-long-local-password', 'Existing User');
		const request = await begin();
		claims.oid = '22222222-2222-4222-8222-222222222222';
		claims.preferred_username = 'collision@anl.gov';
		const user = await finishEntraSignIn(request.callback, request.token);
		expect(user.id).not.toBe(local.id);
		expect(user.username).toMatch(/^collision-[a-f0-9]{6}$/);
	});

	it('explicit linking preserves the original account and permissions and refuses reassignment', async () => {
		const local = await register('linked', 'a-long-local-password', 'Existing Maintainer');
		db.prepare('UPDATE users SET is_admin = 1, verified = 1 WHERE id = ?').run(local.id);
		const objectId = '33333333-3333-4333-8333-333333333333';
		linkEntraIdentity(local.id, objectId);
		linkEntraIdentity(local.id, objectId);
		const request = await begin();
		claims.oid = objectId;
		const user = await finishEntraSignIn(request.callback, request.token);
		expect(user.id).toBe(local.id);
		expect(user.isAdmin).toBe(true);
		expect(user.verified).toBe(true);
		expect(() => linkEntraIdentity(local.id, '44444444-4444-4444-8444-444444444444')).toThrow(
			'already has'
		);
		const other = await register('other', 'another-long-password', 'Other');
		expect(() => linkEntraIdentity(other.id, objectId)).toThrow('another account');
	});

	it('links the validated Argonne identity to the authenticated local account without an object-ID lookup', async () => {
		const local = await register('self-link', 'a-long-local-password', 'Existing Scientist');
		db.prepare('UPDATE users SET is_admin = 1, verified = 1 WHERE id = ?').run(local.id);
		const session = { userId: local.id, sessionToken: createSession(local.id) };
		const request = await begin(session);
		claims.oid = '88888888-8888-4888-8888-888888888888';
		claims.preferred_username = 'different-username@anl.gov';
		const count = db.prepare('SELECT count(*) AS n FROM users').get();
		const user = await finishEntraSignIn(request.callback, request.token, session);
		expect(user.id).toBe(local.id);
		expect(user.username).toBe('self-link');
		expect(user.isAdmin).toBe(true);
		expect(user.verified).toBe(true);
		expect(db.prepare('SELECT count(*) AS n FROM users').get()).toEqual(count);
		expect(entraIdentity(local.id)?.username).toBe('different-username@anl.gov');
		await expect(finishEntraSignIn(request.callback, request.token, session)).rejects.toThrow();
		const login = await begin();
		expect((await finishEntraSignIn(login.callback, login.token)).id).toBe(local.id);
		await expect(startEntraSignIn(undefined, session)).rejects.toThrow('already linked');
	});

	it.each(['missing', 'another-user', 'another-session', 'revoked'])(
		'refuses linking with a %s Hub session',
		async (kind) => {
			const local = await register(`bound-${kind}`, 'a-long-local-password', 'Bound Account');
			const session = { userId: local.id, sessionToken: createSession(local.id) };
			const request = await begin(session);
			let current: typeof session | undefined = session;
			if (kind === 'missing') current = undefined;
			if (kind === 'another-user') current = { ...session, userId: 'another-user' };
			if (kind === 'another-session')
				current = { ...session, sessionToken: createSession(local.id) };
			if (kind === 'revoked') revokeSession(session.sessionToken);
			await expect(finishEntraSignIn(request.callback, request.token, current)).rejects.toThrow();
			expect(entraIdentity(local.id)).toBeUndefined();
			expect(tokenRequests).toHaveLength(0);
		}
	);

	it('rechecks the Hub session after the token exchange', async () => {
		const local = await register('link-signout', 'a-long-local-password', 'Signing Out');
		const session = { userId: local.id, sessionToken: createSession(local.id) };
		const request = await begin(session);
		transport.mockImplementationOnce(async () => {
			revokeSession(session.sessionToken);
			return Response.json({ access_token: 'unused', token_type: 'Bearer', id_token: jwt() });
		});
		await expect(finishEntraSignIn(request.callback, request.token, session)).rejects.toThrow();
		expect(entraIdentity(local.id)).toBeUndefined();
	});

	it('does not move an Argonne identity from another Hub account during self-linking', async () => {
		const owner = await register('link-owner', 'a-long-local-password', 'Original Owner');
		const other = await register('link-other', 'a-long-local-password', 'Other Account');
		const objectId = '99999999-9999-4999-8999-999999999999';
		linkEntraIdentity(owner.id, objectId);
		const session = { userId: other.id, sessionToken: createSession(other.id) };
		const request = await begin(session);
		claims.oid = objectId;
		await expect(finishEntraSignIn(request.callback, request.token, session)).rejects.toThrow(
			'another account'
		);
		expect(entraIdentity(other.id)).toBeUndefined();
		expect(entraIdentity(owner.id)?.subject).toBe(`${tenant}:${objectId}`);
	});

	it.each([
		'state',
		'nonce',
		'issuer',
		'audience',
		'expiry',
		'tenant',
		'object',
		'signature',
		'callback'
	])('rejects invalid %s without creating an identity', async (kind) => {
		const request = await begin();
		claims.oid = '55555555-5555-4555-8555-555555555555';
		if (kind === 'state') request.callback.searchParams.set('state', 'wrong-state');
		if (kind === 'nonce') claims.nonce = 'wrong-nonce';
		if (kind === 'issuer') claims.iss = 'https://other.example';
		if (kind === 'audience') claims.aud = 'another-client';
		if (kind === 'expiry') claims.exp = Math.floor(Date.now() / 1000) - 3600;
		if (kind === 'tenant') claims.tid = '66666666-6666-4666-8666-666666666666';
		if (kind === 'object') delete claims.oid;
		if (kind === 'signature') badSignature = true;
		if (kind === 'callback') request.callback.hostname = 'wrong.example';
		const count = db.prepare('SELECT count(*) AS n FROM identities').get();
		await expect(finishEntraSignIn(request.callback, request.token)).rejects.toThrow();
		expect(db.prepare('SELECT count(*) AS n FROM identities').get()).toEqual(count);
	});

	it('rejects missing cookies, expired requests, and provider denial', async () => {
		const request = await begin();
		await expect(finishEntraSignIn(request.callback)).rejects.toThrow();
		await expect(finishEntraSignIn(request.callback, 'unrelated-browser')).rejects.toThrow();
		db.prepare('UPDATE oidc_requests SET expires_at = 0').run();
		await expect(finishEntraSignIn(request.callback, request.token)).rejects.toThrow();
		const denied = await begin();
		denied.callback.searchParams.delete('code');
		denied.callback.searchParams.set('error', 'access_denied');
		await expect(finishEntraSignIn(denied.callback, denied.token)).rejects.toThrow();
		expect(tokenRequests).toHaveLength(0);
	});

	it('supersedes an abandoned request and tolerates absent optional profile claims', async () => {
		const first = await begin();
		const second = await startEntraSignIn(first.token);
		await expect(finishEntraSignIn(first.callback, first.token)).rejects.toThrow();
		claims.nonce = second.authorizationUrl.searchParams.get('nonce');
		claims.oid = '77777777-7777-4777-8777-777777777777';
		delete claims.name;
		delete claims.preferred_username;
		delete claims.email;
		const callback = new URL(process.env.ENTRA_REDIRECT_URI!);
		callback.searchParams.set('code', 'another-code');
		callback.searchParams.set('state', second.authorizationUrl.searchParams.get('state')!);
		const user = await finishEntraSignIn(callback, second.token);
		expect(user.username).toBe('anl-user');
		expect(entraIdentity(user.id)?.email).toBeNull();
	});

	it('is disabled without credentials', () => {
		expect(entraEnabled()).toBe(true);
		vi.stubEnv('ENTRA_CLIENT_SECRET', '');
		expect(entraEnabled()).toBe(false);
		vi.stubEnv('ENTRA_CLIENT_SECRET', 'test-secret');
	});
});
