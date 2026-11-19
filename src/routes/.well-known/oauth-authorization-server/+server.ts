import { error, json } from '@sveltejs/kit';
import { authorizationServerMetadata } from '#lib/server/oauth.ts';
import { appRoot } from '#lib/server/paths.ts';
import { mcpEnabled } from '#lib/server/mcp-auth.ts';

// RFC 8414, also read before authentication.
export const GET = ({ url }: import('./$types').RequestEvent) => {
	if (!mcpEnabled) error(404, 'Not found.');
	return json(authorizationServerMetadata(url.origin, appRoot === '/' ? '' : appRoot), {
		headers: { 'cache-control': 'public, max-age=3600' }
	});
};
