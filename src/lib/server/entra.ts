import { createHash, randomBytes, randomUUID } from 'node:crypto';
import * as oidc from 'openid-client';
import { db } from './db';
import { sessionUser, userById } from './auth';
import { HubError } from './errors';

export const entraCookie = 'aps_entra';
export const entraRequestLifetime = 10 * 60;
const digest = (value: string) => createHash('sha256').update(value).digest('hex');
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function entraEnabled() {
	return Boolean(process.env.ENTRA_CLIENT_ID && process.env.ENTRA_CLIENT_SECRET);
}

export function entraTenant() {
	const tenant = process.env.ENTRA_TENANT_ID || '0cfca185-25f7-49e3-8ae7-704d5326e285';
	if (!uuid.test(tenant)) throw new Error('ENTRA_TENANT_ID must be a tenant UUID.');
	return tenant.toLowerCase();
}

function settings() {
	if (!entraEnabled()) throw new Error('Entra sign-in is not configured.');
	const redirectUri = new URL(
		process.env.ENTRA_REDIRECT_URI || 'https://kairo.aps.anl.gov:8443/auth/callback/entra'
	);
	if (
		(redirectUri.protocol !== 'https:' &&
			!(
				redirectUri.protocol === 'http:' &&
				['localhost', '127.0.0.1'].includes(redirectUri.hostname)
			)) ||
		redirectUri.username ||
		redirectUri.password ||
		redirectUri.search ||
		redirectUri.hash
	)
		throw new Error('Invalid ENTRA_REDIRECT_URI.');
	return {
		tenant: entraTenant(),
		clientId: process.env.ENTRA_CLIENT_ID!,
		secret: process.env.ENTRA_CLIENT_SECRET!,
		redirectUri: redirectUri.href
	};
}

let cached: { key: string; config: Promise<oidc.Configuration> } | undefined;
async function configuration() {
	const values = settings();
	const key = JSON.stringify(values);
	if (!cached || cached.key !== key) {
		const config = oidc
			.discovery(
				new URL(`https://login.microsoftonline.com/${values.tenant}/v2.0`),
				values.clientId,
				values.secret
			)
			.then((config) => {
				oidc.enableNonRepudiationChecks(config);
				return config;
			});
		cached = { key, config };
		void config.catch(() => {
			if (cached?.config === config) cached = undefined;
		});
	}
	return { ...values, config: await cached.config };
}

interface PendingRequest {
	state: string;
	nonce: string;
	verifier: string;
	redirect_uri: string;
	expires_at: number;
	link_user_id: string | null;
	link_session_hash: string | null;
}

interface LinkSession {
	userId: string;
	sessionToken: string;
}

// Linking must be initiated by a CSRF-protected action after local password verification.
export async function startEntraSignIn(previousToken?: string, link?: LinkSession) {
	if (link) {
		if (sessionUser(link.sessionToken)?.id !== link.userId || !hasIdentity(link.userId, 'local'))
			throw new HubError('Sign in to your existing Hub account before linking.');
		if (hasIdentity(link.userId, 'entra'))
			throw new HubError('Your Argonne account is already linked.');
	}
	const { config, redirectUri } = await configuration();
	const token = randomBytes(32).toString('base64url');
	const state = oidc.randomState();
	const nonce = oidc.randomNonce();
	const verifier = oidc.randomPKCECodeVerifier();
	const challenge = await oidc.calculatePKCECodeChallenge(verifier);
	const authorizationUrl = oidc.buildAuthorizationUrl(config, {
		redirect_uri: redirectUri,
		scope: 'openid profile email',
		response_mode: 'query',
		code_challenge: challenge,
		code_challenge_method: 'S256',
		state,
		nonce,
		prompt: 'select_account'
	});
	db.prepare('DELETE FROM oidc_requests WHERE expires_at <= ? OR token_hash = ?').run(
		Date.now(),
		digest(previousToken || '')
	);
	db.prepare(
		`INSERT INTO oidc_requests
		(token_hash, state, nonce, verifier, redirect_uri, expires_at, link_user_id, link_session_hash)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
	).run(
		digest(token),
		state,
		nonce,
		verifier,
		redirectUri,
		Date.now() + entraRequestLifetime * 1000,
		link?.userId ?? null,
		link ? digest(link.sessionToken) : null
	);
	return { token, authorizationUrl };
}

function checkLinkSession(pending: PendingRequest, session?: LinkSession) {
	if (!pending.link_user_id) return;
	if (
		!session ||
		pending.link_user_id !== session.userId ||
		pending.link_session_hash !== digest(session.sessionToken) ||
		sessionUser(session.sessionToken)?.id !== pending.link_user_id
	)
		throw new HubError('Sign in to the original Hub account and restart linking.');
}

export async function finishEntraSignIn(url: URL, token?: string, session?: LinkSession) {
	if (!token || token.length > 100) throw new Error('Missing sign-in request.');
	// Consume before making network requests: a callback is valid only once.
	const pending = db
		.prepare('DELETE FROM oidc_requests WHERE token_hash = ? RETURNING *')
		.get(digest(token)) as PendingRequest | undefined;
	if (!pending || pending.expires_at <= Date.now()) throw new Error('Sign-in request expired.');
	checkLinkSession(pending, session);
	const { config, tenant, redirectUri } = await configuration();
	if (pending.redirect_uri !== redirectUri || `${url.origin}${url.pathname}` !== redirectUri)
		throw new Error('Sign-in callback does not match configuration.');
	const tokens = await oidc.authorizationCodeGrant(config, url, {
		pkceCodeVerifier: pending.verifier,
		expectedState: pending.state,
		expectedNonce: pending.nonce,
		idTokenExpected: true
	});
	const claims = tokens.claims();
	if (!claims || claims.tid !== tenant || typeof claims.oid !== 'string' || !uuid.test(claims.oid))
		throw new Error('An Argonne tenant identity is required.');
	const objectId = claims.oid;
	return db.transaction(() => {
		// Recheck after the network exchange in case the user signed out or reset their password.
		checkLinkSession(pending, session);
		if (pending.link_user_id) linkEntraIdentity(pending.link_user_id, objectId);
		return entraUser(tenant, objectId, claims.name, claims.preferred_username, claims.email);
	})();
}

function subjectFor(tenant: string, objectId: string) {
	if (!uuid.test(tenant) || !uuid.test(objectId))
		throw new HubError('Use a valid tenant and object ID.');
	return `${tenant.toLowerCase()}:${objectId.toLowerCase()}`;
}

// Call only after validating the ID token. Mutable profile claims are display hints, not identity keys.
function entraUser(
	tenant: string,
	objectId: string,
	name: unknown,
	preferredUsername: unknown,
	email: unknown
) {
	const subject = subjectFor(tenant, objectId);
	return db.transaction(() => {
		const providerUsername =
			typeof preferredUsername === 'string' ? preferredUsername.slice(0, 320) : null;
		const providerEmail = typeof email === 'string' ? email.slice(0, 320) : null;
		const identity = db
			.prepare("SELECT user_id FROM identities WHERE provider = 'entra' AND subject = ?")
			.get(subject) as { user_id: string } | undefined;
		if (identity) {
			db.prepare(
				"UPDATE identities SET provider_username = ?, email = ? WHERE provider = 'entra' AND subject = ?"
			).run(providerUsername, providerEmail, subject);
			return userById(identity.user_id)!;
		}
		let stem =
			typeof preferredUsername === 'string' ? preferredUsername.split('@')[0].toLowerCase() : '';
		stem = stem.replace(/[^a-z0-9_-]/g, '').slice(0, 24);
		if (!/^[a-z][a-z0-9_-]{2,23}$/.test(stem)) stem = 'anl-user';
		let username = stem;
		while (db.prepare('SELECT 1 FROM users WHERE username = ?').get(username))
			username = `${stem}-${randomBytes(3).toString('hex')}`;
		const id = randomUUID();
		const displayName = typeof name === 'string' ? name.trim().slice(0, 80) : '';
		db.prepare('INSERT INTO users (id, username, display_name) VALUES (?, ?, ?)').run(
			id,
			username,
			displayName || username
		);
		db.prepare(
			"INSERT INTO identities (user_id, provider, subject, provider_username, email) VALUES (?, 'entra', ?, ?, ?)"
		).run(id, subject, providerUsername, providerEmail);
		return userById(id)!;
	})();
}

export function linkEntraIdentity(userId: string, objectId: string) {
	const subject = subjectFor(entraTenant(), objectId);
	db.transaction(() => {
		if (!userById(userId)) throw new HubError('Account not found.');
		const existing = db
			.prepare("SELECT user_id FROM identities WHERE provider = 'entra' AND subject = ?")
			.get(subject) as { user_id: string } | undefined;
		if (existing?.user_id === userId) return;
		if (existing) throw new HubError('That Entra identity is already linked to another account.');
		if (hasIdentity(userId, 'entra'))
			throw new HubError('This account already has an Entra identity.');
		db.prepare("INSERT INTO identities (user_id, provider, subject) VALUES (?, 'entra', ?)").run(
			userId,
			subject
		);
	})();
}

export function hasIdentity(userId: string, provider: 'local' | 'entra') {
	return Boolean(
		db.prepare('SELECT 1 FROM identities WHERE user_id = ? AND provider = ?').get(userId, provider)
	);
}

export function entraIdentity(userId: string) {
	return db
		.prepare(
			"SELECT subject, provider_username AS username, email FROM identities WHERE user_id = ? AND provider = 'entra'"
		)
		.get(userId) as { subject: string; username: string | null; email: string | null } | undefined;
}
