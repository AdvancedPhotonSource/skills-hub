import { error } from '@sveltejs/kit';
import { createMcpHandler } from '@modelcontextprotocol/server';
import { mcpEnabled, verifyAccessToken, bearerToken, mcpScopes } from '#lib/server/mcp-auth.ts';
import { buildMcpServer } from '#lib/server/mcp.ts';
import { appRoot } from '#lib/server/paths.ts';
import type { User } from '#lib/types.ts';

// One handler for the process; the factory builds a per-request server from the
// auth info this route verified. The SDK never reads credentials itself.
const handler = createMcpHandler((ctx) => {
	const user = ctx.authInfo?.extra?.user as User | undefined;
	if (!user) throw new Error('MCP server constructed without a verified user.');
	// The route owns the base path; the tool layer only ever sees a finished URL.
	const origin = ctx.requestInfo ? new URL(ctx.requestInfo.url).origin : '';
	const hubUrl = `${origin}${appRoot === '/' ? '' : appRoot}`;
	return buildMcpServer(user, hubUrl, ctx.authInfo?.scopes ?? []);
});

const challenge = (reason: string) =>
	new Response(JSON.stringify({ error: reason }), {
		status: 401,
		headers: {
			'content-type': 'application/json',
			// RFC 6750. The resource_metadata pointer (RFC 9728) is added with the
			// authorization server; advertising a document that names no issuer
			// would send clients somewhere that cannot mint tokens.
			'WWW-Authenticate': `Bearer error="invalid_token", scope="${mcpScopes.join(' ')}"`
		}
	});

export const POST = async ({ request }: import('./$types').RequestEvent) => {
	if (!mcpEnabled) error(404, 'Not found.');
	const token = bearerToken(request.headers.get('authorization'));
	if (!token) return challenge('A bearer token is required.');
	const verified = verifyAccessToken(token);
	if (!verified) return challenge('The access token is invalid or expired.');
	return handler.fetch(request, {
		authInfo: {
			token,
			clientId: verified.user.id,
			scopes: verified.scopes,
			expiresAt: Math.floor(verified.expiresAt / 1000),
			extra: { user: verified.user }
		}
	});
};
