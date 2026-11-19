import { beforeAll, describe, expect, it } from 'vitest';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const directory = mkdtempSync(join(tmpdir(), 'aps-hub-grants-'));
process.env.DATA_DIR = directory;
const { db } = await import('../src/lib/server/db');
const { register } = await import('../src/lib/server/auth');
const { validatePackage } = await import('../src/lib/server/packages');
const { publish } = await import('../src/lib/server/catalog');
const { mintDownloadGrant, redeemDownloadGrant, downloadActor, grantUses, grantParam } =
	await import('../src/lib/server/grants');

let owner: Awaited<ReturnType<typeof register>>;
let other: typeof owner;
let skillId: string;
const pkg = () =>
	validatePackage([
		{
			path: 'SKILL.md',
			data: Buffer.from(
				'---\nname: grant-skill\ndescription: A skill for grant tests\n---\n\n# Hi\n'
			),
			mode: 0o644
		}
	]);

const link = (token: string, revision = 1, id = skillId) =>
	new URL(`https://hub.test/skills/${id}/download?revision=${revision}&${grantParam}=${token}`);

beforeAll(async () => {
	owner = await register('grant-owner', 'long-passphrase-for-owner', 'Owner');
	other = await register('grant-other', 'long-passphrase-for-other', 'Other');
	skillId = publish(owner, pkg(), { categories: ['reduction'], tags: [], role: '' });
});

describe('download grants', () => {
	it('resolves to the user it was minted for, and only for its own entry and revision', () => {
		const token = mintDownloadGrant(skillId, 1, owner.id);
		expect(redeemDownloadGrant(token, skillId, 2)).toBeNull();
		expect(redeemDownloadGrant(token, 'another-entry', 1)).toBeNull();
		expect(redeemDownloadGrant(token, skillId, 1)?.id).toBe(owner.id);
	});

	it('rejects forged, empty and oversized tokens without throwing', () => {
		expect(redeemDownloadGrant('', skillId, 1)).toBeNull();
		expect(redeemDownloadGrant('not-a-real-token', skillId, 1)).toBeNull();
		expect(redeemDownloadGrant('x'.repeat(5000), skillId, 1)).toBeNull();
	});

	it('stores only a hash, so the database never holds a usable link', () => {
		const token = mintDownloadGrant(skillId, 1, owner.id);
		const rows = db.prepare('SELECT token_hash FROM download_grants').all() as {
			token_hash: string;
		}[];
		expect(rows.some((row) => row.token_hash === token)).toBe(false);
		expect(rows.length).toBeGreaterThan(0);
	});

	it('allows a bounded number of retries, then stops', () => {
		const token = mintDownloadGrant(skillId, 1, owner.id);
		for (let attempt = 0; attempt < grantUses; attempt++)
			expect(redeemDownloadGrant(token, skillId, 1)?.id).toBe(owner.id);
		expect(redeemDownloadGrant(token, skillId, 1)).toBeNull();
	});

	it('expires', () => {
		const token = mintDownloadGrant(skillId, 1, owner.id);
		db.prepare('UPDATE download_grants SET expires_at = ? WHERE expires_at > ?').run(
			Date.now() - 1000,
			Date.now() - 2000
		);
		expect(redeemDownloadGrant(token, skillId, 1)).toBeNull();
	});

	it('prefers an existing session and never consumes a grant for a signed-in user', () => {
		const token = mintDownloadGrant(skillId, 1, owner.id);
		expect(downloadActor(other, link(token), skillId).id).toBe(other.id);
		expect(redeemDownloadGrant(token, skillId, 1)?.id).toBe(owner.id);
	});

	it('refuses a link with no grant, a bad grant, or no pinned revision', () => {
		const token = mintDownloadGrant(skillId, 1, owner.id);
		const noGrant = new URL(`https://hub.test/skills/${skillId}/download?revision=1`);
		expect(() => downloadActor(null, noGrant, skillId)).toThrow(/expired or is not valid/);
		expect(() => downloadActor(null, link('forged'), skillId)).toThrow(/expired or is not valid/);
		const noRevision = new URL(
			`https://hub.test/skills/${skillId}/download?${grantParam}=${token}`
		);
		expect(() => downloadActor(null, noRevision, skillId)).toThrow(/expired or is not valid/);
	});

	it('accepts a complete link and returns the minting user', () => {
		const token = mintDownloadGrant(skillId, 1, owner.id);
		expect(downloadActor(null, link(token), skillId).id).toBe(owner.id);
	});
});
