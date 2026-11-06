import type { BrowserContext } from '@playwright/test';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import Database from 'better-sqlite3';
import { join } from 'node:path';

// Test-runner-only fixtures write the isolated test DB. The application has no auth bypass.
export async function signIn(
	context: BrowserContext,
	username: string,
	options: {
		provider?: 'local' | 'entra';
		expired?: boolean;
		displayName?: string;
	} = {}
) {
	const db = new Database(join(process.env.E2E_DATA_DIR!, 'hub.sqlite'));
	let user = db.prepare('SELECT id FROM users WHERE username = ?').get(username) as
		{ id: string } | undefined;
	if (!user) {
		user = { id: randomUUID() };
		db.prepare('INSERT INTO users (id, username, display_name) VALUES (?, ?, ?)').run(
			user.id,
			username,
			options.displayName || username
		);
		db.prepare(
			"INSERT INTO identities (user_id, provider, subject, provider_username) VALUES (?, 'entra', ?, ?)"
		).run(user.id, `0cfca185-25f7-49e3-8ae7-704d5326e285:${randomUUID()}`, `${username}@anl.gov`);
	}
	const token = randomBytes(32).toString('base64url');
	db.prepare(
		'INSERT INTO sessions (token_hash, user_id, expires_at, provider) VALUES (?, ?, ?, ?)'
	).run(
		createHash('sha256').update(token).digest('hex'),
		user.id,
		Date.now() + (options.expired ? -60000 : 600000),
		options.provider || 'entra'
	);
	db.close();
	await context.addCookies([
		{
			name: 'aps_session',
			value: token,
			url: 'http://127.0.0.1:4173',
			httpOnly: true,
			sameSite: 'Lax'
		}
	]);
	return token;
}
