import { createHash, randomBytes } from 'node:crypto';
import { db } from './db';
import { userById } from './auth';
import type { User } from '../types';

// On by default now that the endpoint authenticates through this hub's own
// OAuth 2.1 server. ENABLE_MCP=0 is a kill switch: it takes /mcp and the OAuth
// discovery documents out of service together, so nothing advertises a
// resource that is not answering.
export const mcpEnabled = process.env.ENABLE_MCP !== '0';

export const mcpScopes = ['catalog:read', 'skills:download'] as const;
export type McpScope = (typeof mcpScopes)[number];

const digest = (value: string) => createHash('sha256').update(value).digest('hex');
const tokenLifetime = 60 * 60 * 24 * 30 * 1000;

export type VerifiedToken = { user: User; scopes: string[]; expiresAt: number };

/**
 * Access tokens are opaque and stored hashed. They are minted by this hub's own
 * OAuth 2.1 authorization server in src/lib/server/oauth.ts, which federates
 * user authentication to Argonne Entra; `npm run mcp:token` can also issue one
 * directly for administrative testing.
 */
export function verifyAccessToken(token: string, expectedResource?: string): VerifiedToken | null {
	if (!token || token.length > 200) return null;
	const row = db
		.prepare('SELECT user_id, scopes, expires_at, resource FROM mcp_tokens WHERE token_hash = ?')
		.get(digest(token)) as
		{ user_id: string; scopes: string; expires_at: number; resource: string } | undefined;
	if (!row || row.expires_at <= Date.now()) return null;
	// RFC 8707 audience binding: a token minted for another resource is not ours
	// to accept, even though we issued it.
	const strip = (value: string) => value.replace(/\/$/, '');
	if (expectedResource && row.resource && strip(row.resource) !== strip(expectedResource))
		return null;
	const user = userById(row.user_id);
	return user ? { user, scopes: JSON.parse(row.scopes), expiresAt: row.expires_at } : null;
}

export function mintMcpToken(
	userId: string,
	scopes: readonly string[] = mcpScopes,
	label = '',
	lifetimeMs = tokenLifetime
) {
	const token = randomBytes(32).toString('base64url');
	db.prepare('DELETE FROM mcp_tokens WHERE expires_at <= ?').run(Date.now());
	db.prepare(
		'INSERT INTO mcp_tokens (token_hash, user_id, scopes, label, expires_at) VALUES (?, ?, ?, ?, ?)'
	).run(digest(token), userId, JSON.stringify([...scopes]), label, Date.now() + lifetimeMs);
	return token;
}

export function revokeMcpToken(token: string) {
	return db.prepare('DELETE FROM mcp_tokens WHERE token_hash = ?').run(digest(token)).changes > 0;
}

export const bearerToken = (header: string | null) =>
	header?.startsWith('Bearer ') ? header.slice(7).trim() : null;
