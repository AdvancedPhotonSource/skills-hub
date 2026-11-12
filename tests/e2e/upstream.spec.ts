import { test, expect } from '@playwright/test';
import { createHash } from 'node:crypto';
import { signIn } from './session';

test('backend update replaces the existing commit attribution without sync controls', async ({
	page
}) => {
	await signIn(page.context(), 'upstream-owner');
	process.env.DATA_DIR = process.env.E2E_DATA_DIR;
	const { db } = await import('../../src/lib/server/db');
	const { userById } = await import('../../src/lib/server/auth');
	const { publish } = await import('../../src/lib/server/catalog');
	const { validatePackage } = await import('../../src/lib/server/packages');
	const { syncUpstreams } = await import('../../src/lib/server/upstream-sync');
	const row = db.prepare("SELECT id FROM users WHERE username='upstream-owner'").get() as {
		id: string;
	};
	const oldCommit = '3'.repeat(40);
	const newCommit = '4'.repeat(40);
	const original =
		'---\nname: upstream-browser-test\ndescription: Imported instructions\n---\n# Original instructions\n';
	const updated = Buffer.from(
		original.replace('Original instructions', 'Updated upstream instructions')
	);
	const pkg = validatePackage([{ path: 'SKILL.md', data: Buffer.from(original), mode: 0o644 }]);
	pkg.source = {
		repository: 'AdvancedPhotonSource/upstream-browser-test',
		directory: 'skills/demo',
		ref: 'main',
		commit: oldCommit,
		commitDate: '2026-11-01T00:00:00Z',
		author: 'AdvancedPhotonSource',
		licenses: []
	};
	const id = publish(userById(row.id)!, pkg, { categories: ['python'], tags: [], role: '' });
	await page.goto(`/skills/${id}`);
	await expect(page.getByText(/Imported from commit/)).toHaveCount(1);
	await expect(page.locator('.source-line')).toContainText(oldCommit.slice(0, 12));
	const fetch = globalThis.fetch;
	try {
		globalThis.fetch = async (input) => {
			const url = String(input);
			if (url.startsWith('https://raw.githubusercontent.com/'))
				return new Response(new Uint8Array(updated));
			if (url.includes('/commits/'))
				return Response.json({
					sha: newCommit,
					commit: { tree: { sha: 'a'.repeat(40) }, committer: { date: '2026-11-02T00:00:00Z' } }
				});
			if (url.includes('/git/trees/'))
				return Response.json({
					tree: [
						{
							path: 'skills/demo/SKILL.md',
							type: 'blob',
							mode: '100644',
							size: updated.length,
							sha: createHash('sha1')
								.update(`blob ${updated.length}\0`)
								.update(updated)
								.digest('hex')
						}
					]
				});
			return Response.json({ private: false, default_branch: 'main' });
		};
		expect(await syncUpstreams(() => {})).toMatchObject({ updated: 1, failed: 0 });
	} finally {
		globalThis.fetch = fetch;
		db.close();
	}
	await page.reload();
	await expect(page.getByText(/Imported from commit/)).toHaveCount(1);
	await expect(page.locator('.source-line')).toContainText(newCommit.slice(0, 12));
	await expect(
		page.locator('.source-line a').filter({ hasText: newCommit.slice(0, 12) })
	).toHaveAttribute(
		'href',
		`https://github.com/AdvancedPhotonSource/upstream-browser-test/commit/${newCommit}`
	);
	await expect(page.getByRole('heading', { name: 'Updated upstream instructions' })).toBeVisible();
	await expect(
		page.getByText(/last checked|sync status|sync now|refresh from github/i)
	).toHaveCount(0);
	await page.goto(`/skills/${id}/edit`);
	await expect(page.getByRole('button', { name: /sync|refresh/i })).toHaveCount(0);
	const response = await page.request.post(`/skills/${id}/edit?/refresh`, {
		headers: { origin: 'http://127.0.0.1:4173' },
		form: { expected: '2' }
	});
	expect(response.status()).toBe(404);
	await page.goto(`/skills/${id}?revision=1`);
	await expect(page.locator('.source-line')).toContainText(oldCommit.slice(0, 12));
});
