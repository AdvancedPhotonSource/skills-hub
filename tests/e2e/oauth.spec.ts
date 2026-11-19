import { test, expect } from '@playwright/test';
import { createHash, randomBytes } from 'node:crypto';
import { signIn } from './session';

const origin = 'http://127.0.0.1:4173';
const callback = 'http://127.0.0.1:59123/callback';

test('an agent connects through Argonne SSO and uses the hub without anyone handling a token', async ({
	page,
	context,
	request
}) => {
	// 1. The client hits the endpoint cold and is told where to get a token.
	const cold = await request.post('/mcp', {
		headers: { 'content-type': 'application/json' },
		data: {}
	});
	expect(cold.status()).toBe(401);
	expect(cold.headers()['www-authenticate']).toContain(
		`resource_metadata="${origin}/.well-known/oauth-protected-resource"`
	);

	// 2. Discovery, readable with no session at all.
	const prm = await (await request.get('/.well-known/oauth-protected-resource')).json();
	expect(prm.resource).toBe(`${origin}/mcp`);
	const asm = await (await request.get('/.well-known/oauth-authorization-server')).json();
	expect(asm.issuer).toBe(prm.authorization_servers[0]);
	expect(asm.code_challenge_methods_supported).toEqual(['S256']);

	// 3. The client registers itself. No human involved.
	const registration = await request.post(asm.registration_endpoint, {
		data: { redirect_uris: [callback], client_name: 'E2E Agent' }
	});
	expect(registration.status()).toBe(201);
	const { client_id: clientId } = await registration.json();

	// 4. The browser leg. Unauthenticated, it routes through Argonne sign-in.
	const verifier = randomBytes(32).toString('base64url');
	const authorize =
		'/oauth/authorize?' +
		new URLSearchParams({
			client_id: clientId,
			redirect_uri: callback,
			response_type: 'code',
			code_challenge_method: 'S256',
			code_challenge: createHash('sha256').update(verifier).digest('base64url'),
			resource: `${origin}/mcp`,
			state: 'opaque-state'
		});
	const anonymous = await context.request.get(authorize, { maxRedirects: 0 });
	expect(anonymous.status()).toBe(303);
	expect(anonymous.headers()['location']).toContain('/sign-in');

	// 5. Signed in, the person sees what they are approving.
	await signIn(context, 'oauth-scientist', { displayName: 'OAuth Scientist' });
	await page.goto(authorize);
	await expect(page.getByRole('heading', { name: /Connect\s+E2E Agent/ })).toBeVisible();
	await expect(page.getByText('Search the catalogue and read')).toBeVisible();
	await expect(page.getByText('OAuth Scientist')).toBeVisible();

	// Approving is a real browser form submit. Capture the loopback redirect that
	// the client's own listener would receive; nothing is serving that port here.
	const landed = new Promise<string>((resolve) => {
		page.on('request', (req) => {
			if (req.url().startsWith(callback)) resolve(req.url());
		});
	});
	await page.getByRole('button', { name: 'Connect', exact: true }).click();
	const returned = new URL(await landed);
	expect(returned.origin + returned.pathname).toBe(callback);
	expect(returned.searchParams.get('state')).toBe('opaque-state');
	// RFC 9207, so the client can detect a mix-up attack.
	expect(returned.searchParams.get('iss')).toBe(origin);
	const code = returned.searchParams.get('code')!;
	expect(code).toBeTruthy();

	// 6. The client redeems the code itself, with no cookie and no Origin header.
	// A real agent is not a browser; if the framework's CSRF guard reached this
	// endpoint it would reject every genuine client with 403.
	const noOrigin = await request.post('/oauth/token', {
		headers: { 'content-type': 'application/x-www-form-urlencoded' },
		data: 'grant_type=authorization_code&code=bogus&code_verifier=x&redirect_uri=x&client_id=x'
	});
	expect(noOrigin.status()).toBe(400);
	expect((await noOrigin.json()).error).toBe('invalid_grant');

	const wrongVerifier = await request.post('/oauth/token', {
		form: {
			grant_type: 'authorization_code',
			code,
			code_verifier: randomBytes(32).toString('base64url'),
			redirect_uri: callback,
			client_id: clientId
		}
	});
	expect(wrongVerifier.status()).toBe(400);

	const exchanged = await request.post('/oauth/token', {
		form: {
			grant_type: 'authorization_code',
			code,
			code_verifier: verifier,
			redirect_uri: callback,
			client_id: clientId,
			resource: `${origin}/mcp`
		}
	});
	expect(exchanged.status()).toBe(200);
	const tokens = await exchanged.json();
	expect(tokens.token_type).toBe('Bearer');
	expect(tokens.refresh_token).toBeTruthy();

	// 7. The token works against the MCP endpoint.
	const tools = await request.post('/mcp', {
		headers: {
			authorization: `Bearer ${tokens.access_token}`,
			'content-type': 'application/json',
			accept: 'application/json, text/event-stream',
			'MCP-Protocol-Version': '2026-07-28',
			'Mcp-Method': 'tools/list'
		},
		data: {
			jsonrpc: '2.0',
			id: 1,
			method: 'tools/list',
			params: {
				_meta: {
					'io.modelcontextprotocol/protocolVersion': '2026-07-28',
					'io.modelcontextprotocol/clientInfo': { name: 'e2e', version: '1.0.0' },
					'io.modelcontextprotocol/clientCapabilities': {}
				}
			}
		}
	});
	expect(tools.status()).toBe(200);
	const names = (await tools.json()).result.tools.map((t: { name: string }) => t.name);
	expect(names.sort()).toEqual(['get_skill', 'install_skill', 'read_skill_file', 'search_skills']);

	// 8. Refreshing rotates, and the spent refresh token stops working.
	const refreshed = await request.post('/oauth/token', {
		form: { grant_type: 'refresh_token', refresh_token: tokens.refresh_token, client_id: clientId }
	});
	expect(refreshed.status()).toBe(200);
	expect((await refreshed.json()).refresh_token).not.toBe(tokens.refresh_token);
	const replay = await request.post('/oauth/token', {
		form: { grant_type: 'refresh_token', refresh_token: tokens.refresh_token, client_id: clientId }
	});
	expect(replay.status()).toBe(400);
});
