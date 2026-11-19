import { error, json } from '@sveltejs/kit';
import { protectedResourceMetadata } from '#lib/server/oauth.ts';
import { appRoot } from '#lib/server/paths.ts';
import { mcpEnabled } from '#lib/server/mcp-auth.ts';

// RFC 9728. Public by necessity: a client reads this before it holds any token.
// It names endpoints and scopes only, never catalog content.
export const GET = ({ url }: import('./$types').RequestEvent) => {
	if (!mcpEnabled) error(404, 'Not found.');
	return json(protectedResourceMetadata(url.origin, appRoot === '/' ? '' : appRoot), {
		headers: { 'cache-control': 'public, max-age=3600' }
	});
};
