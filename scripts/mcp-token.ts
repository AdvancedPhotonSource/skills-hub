/**
 * Issue or revoke an MCP access token for smoke-testing the /mcp endpoint.
 *
 * Temporary. The MCP server ships behind ENABLE_MCP while its authorization
 * server is built; once OAuth 2.1 is in place, clients obtain tokens through a
 * browser sign-in and nobody runs this. Tokens printed here are bearer
 * credentials: treat them like a password and revoke them when finished.
 */
import { db } from '../src/lib/server/db';
import { mintMcpToken, revokeMcpToken, mcpScopes } from '../src/lib/server/mcp-auth';

const [command, value, ...rest] = process.argv.slice(2);
const usage =
	'Usage: npm run mcp:token -- issue <username> [scope ...]\n' +
	'       npm run mcp:token -- revoke <token>\n' +
	`Scopes: ${mcpScopes.join(', ')}`;

if (command === 'revoke' && value) {
	console.log(revokeMcpToken(value) ? 'Token revoked.' : 'No matching token.');
} else if (command === 'issue' && value) {
	const user = db
		.prepare('SELECT id, display_name AS name FROM users WHERE username=?')
		.get(value) as { id: string; name: string } | undefined;
	const scopes = rest.length ? rest : [...mcpScopes];
	const unknown = scopes.filter(
		(scope) => !mcpScopes.includes(scope as (typeof mcpScopes)[number])
	);
	if (!user) {
		console.error('Account not found.');
		process.exitCode = 1;
	} else if (unknown.length) {
		console.error(`Unknown scope: ${unknown.join(', ')}\n${usage}`);
		process.exitCode = 1;
	} else {
		const token = mintMcpToken(user.id, scopes, `cli:${value}`);
		console.log(`Issued for ${user.name} with scopes [${scopes.join(', ')}].`);
		console.log('Send it as: Authorization: Bearer <token>\n');
		console.log(token);
	}
} else {
	console.error(usage);
	process.exitCode = 1;
}
db.close();
