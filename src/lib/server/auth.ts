import { randomBytes, createHash, randomUUID } from 'node:crypto';
import { hash, verify } from '@node-rs/argon2';
import { db } from './db';
import type { User } from '../types';
import { HubError } from './errors';

const hashOptions = { memoryCost: 19456, timeCost: 2, parallelism: 1 };
const digest = (value: string) => createHash('sha256').update(value).digest('hex');
export const sessionCookie = 'aps_session';
export const sessionLifetime = 60 * 60 * 24 * 7;

export function userById(id: string): User | null {
	const row = db
		.prepare(
			'SELECT id, username, display_name AS displayName, is_admin AS isAdmin FROM users WHERE id = ?'
		)
		.get(id) as User | undefined;
	return row ? { ...row, isAdmin: Boolean(row.isAdmin) } : null;
}

export function checkPassword(password: string) {
	if (password.length < 12 || password.length > 128)
		throw new HubError('Use a password between 12 and 128 characters.');
}

export async function register(username: string, password: string, displayName: string) {
	username = username.trim().toLowerCase();
	if (!/^[a-z][a-z0-9_-]{2,31}$/.test(username))
		throw new HubError(
			'Use 3–32 characters: start with a letter, then letters, numbers, hyphens or underscores.'
		);
	checkPassword(password);
	if (displayName.length > 80) throw new HubError('Display name must be 80 characters or fewer.');
	const passwordHash = await hash(password, hashOptions);
	const id = randomUUID();
	db.transaction(() => {
		if (db.prepare('SELECT 1 FROM users WHERE username = ?').get(username))
			throw new HubError('That username is already taken.');
		db.prepare('INSERT INTO users (id, username, display_name) VALUES (?, ?, ?)').run(
			id,
			username,
			displayName.trim() || username
		);
		db.prepare(
			"INSERT INTO identities (user_id, provider, subject, password_hash) VALUES (?, 'local', ?, ?)"
		).run(id, username, passwordHash);
	})();
	return userById(id)!;
}

// Unknown usernames still perform the same password-hashing work.
const dummyHash = hash('unused-credential-' + randomBytes(32).toString('hex'), hashOptions);

export async function authenticate(username: string, password: string) {
	const row = db
		.prepare(
			"SELECT user_id, password_hash FROM identities WHERE provider = 'local' AND subject = ?"
		)
		.get(username.trim().toLowerCase()) as { user_id: string; password_hash: string } | undefined;
	const valid = await verify(row?.password_hash ?? (await dummyHash), password.slice(0, 129));
	return valid && row && password.length <= 128 ? userById(row.user_id) : null;
}

export function createSession(userId: string) {
	const token = randomBytes(32).toString('base64url');
	db.prepare('DELETE FROM sessions WHERE expires_at < ?').run(Date.now());
	db.prepare('INSERT INTO sessions VALUES (?, ?, ?)').run(
		digest(token),
		userId,
		Date.now() + sessionLifetime * 1000
	);
	return token;
}

export function sessionUser(token: string | undefined) {
	if (!token || token.length > 100) return null;
	const row = db
		.prepare('SELECT user_id FROM sessions WHERE token_hash = ? AND expires_at > ?')
		.get(digest(token), Date.now()) as { user_id: string } | undefined;
	return row ? userById(row.user_id) : null;
}

export function revokeSession(token: string | undefined) {
	if (token) db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(digest(token));
}

export async function resetPassword(userId: string, password: string) {
	checkPassword(password);
	const passwordHash = await hash(password, hashOptions);
	db.transaction(() => {
		const result = db
			.prepare("UPDATE identities SET password_hash = ? WHERE user_id = ? AND provider = 'local'")
			.run(passwordHash, userId);
		if (!result.changes) throw new Error('Local account not found.');
		db.prepare('DELETE FROM sessions WHERE user_id = ?').run(userId);
	})();
}

export function allowAttempt(key: string, limit = 10, windowMs = 15 * 60 * 1000) {
	const now = Date.now();
	db.prepare('DELETE FROM rate_limits WHERE expires_at <= ?').run(now);
	const row = db
		.prepare(
			`INSERT INTO rate_limits VALUES (?, 1, ?) ON CONFLICT(key) DO UPDATE SET attempts = attempts + 1 RETURNING attempts`
		)
		.get(digest(key), now + windowMs) as { attempts: number };
	return row.attempts <= limit;
}
