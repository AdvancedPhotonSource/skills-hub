import { randomBytes, createHash } from 'node:crypto';
import { db } from './db';
import { userById } from './auth';
import type { User } from '../types';
import { HubError } from './errors';

// A download grant is a capability: the URL carries its own authorization, so a
// tool that cannot hold an SSO cookie (npx, curl, an agent) can fetch exactly one
// revision of one entry. Grants are stored rather than signed so they need no
// deployment secret, can be revoked, and expire on their own.
const digest = (value: string) => createHash('sha256').update(value).digest('hex');

export const grantParam = 'grant';
export const grantLifetime = 30 * 60 * 1000;
// More than one use so a dropped connection can be retried; few enough that a
// leaked URL stays cheap. The short lifetime is the real limit.
export const grantUses = 5;

export function mintDownloadGrant(skillId: string, revision: number, userId: string) {
	const token = randomBytes(32).toString('base64url');
	db.prepare('DELETE FROM download_grants WHERE expires_at <= ?').run(Date.now());
	db.prepare(
		`INSERT INTO download_grants (token_hash, skill_id, revision, user_id, expires_at)
		VALUES (?, ?, ?, ?, ?)`
	).run(digest(token), skillId, revision, userId, Date.now() + grantLifetime);
	return token;
}

/** The user a grant was minted for, or null. Consumes one use; never throws for a bad token. */
export function redeemDownloadGrant(token: string, skillId: string, revision: number) {
	if (!token || token.length > 100) return null;
	const row = db
		.prepare(
			`UPDATE download_grants SET uses = uses + 1
			WHERE token_hash = ? AND skill_id = ? AND revision = ? AND expires_at > ? AND uses < ?
			RETURNING user_id`
		)
		.get(digest(token), skillId, revision, Date.now(), grantUses) as
		{ user_id: string } | undefined;
	return row ? userById(row.user_id) : null;
}

/**
 * Resolve the downloader: an SSO session when present, otherwise a grant.
 * A grant always names one explicit revision, so a link without `revision` is
 * rejected rather than being resolved against whatever is current.
 */
export function downloadActor(session: User | null, url: URL, skillId: string): User {
	if (session) return session;
	const version = url.searchParams.get('revision') || '';
	const granted = /^[1-9]\d*$/.test(version)
		? redeemDownloadGrant(url.searchParams.get(grantParam) || '', skillId, Number(version))
		: null;
	if (!granted)
		throw new HubError(
			'This download link has expired or is not valid. Open the entry in the hub for a fresh link.',
			401
		);
	return granted;
}
