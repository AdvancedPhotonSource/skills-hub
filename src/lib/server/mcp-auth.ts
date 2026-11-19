import { createHash, randomBytes } from 'node:crypto';
import { db } from './db';
import { userById } from './auth';
import type { User } from '../types';

// The MCP surface ships dark until an authorization server exists. ENABLE_MCP=1
// turns on the route; without it /mcp stays behind the site's fail-closed gate.
export const mcpEnabled = process.env.ENABLE_MCP === '1';

export const mcpScopes = ['catalog:read', 'skills:download'] as const;
export type McpScope = (typeof mcpScopes)[number];

const digest = (value: string) => createHash('sha256').update(value).digest('hex');
const tokenLifetime = 60 * 60 * 24 * 30 * 1000;

export type VerifiedToken = { user: User; scopes: string[]; expiresAt: number };

/**
 * Scaffolding. Tokens live in a local table so the MCP server can be built and
 * tested before the OAuth 2.1 authorization server exists. When that lands, only
 * the body of this function changes: the tools, transport and route stay as they
 * are. Nothing issues these tokens through the UI, by design.
 */
export function verifyAccessToken(token: string): VerifiedToken | null {
	if (!token || token.length > 200) return null;
	const row = db
		.prepare('SELECT user_id, scopes, expires_at FROM mcp_tokens WHERE token_hash = ?')
		.get(digest(token)) as { user_id: string; scopes: string; expires_at: number } | undefined;
	if (!row || row.expires_at <= Date.now()) return null;
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
