import { test, expect } from '@playwright/test';
import { unzipSync } from 'fflate';
import AxeBuilder from '@axe-core/playwright';

const source =
	'---\nname: browser-test-skill\ndescription: Explore HDF5 arrays and metadata with Python\n---\n\n# Explore HDF5 data\n\nRead metadata before loading arrays.\n';
const origin = 'http://127.0.0.1:4173';

test('publish, discover, download, protect ownership, and revise a skill', async ({
	page,
	browser
}) => {
	const errors: string[] = [];
	page.on('pageerror', (error) => errors.push(error.message));
	await page.goto('/');
	await expect(
		page.getByRole('heading', { name: 'Find the skill for your next task.' })
	).toBeVisible();
	await page.getByRole('link', { name: 'Sign in', exact: true }).click();
	await page.getByRole('link', { name: 'Create an account' }).click();
	await expect(page).toHaveURL(/\/register$/);
	expect(
		(await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze())
			.violations
	).toEqual([]);
	await page.getByLabel('Username', { exact: true }).fill('owner');
	await page.getByLabel('Display name').fill('Test Owner');
	await page.getByLabel('Password', { exact: true }).fill('a-good-long-test-passphrase');
	await page.getByRole('button', { name: 'Create account' }).click();
	await expect(page).toHaveURL(/\/my-skills$/);
	await page.goto('/upload');
	expect(
		(await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze())
			.violations
	).toEqual([]);
	await page
		.locator('input[type=file]')
		.setInputFiles({ name: 'SKILL.md', mimeType: 'text/markdown', buffer: Buffer.from(source) });
	await page.getByRole('button', { name: 'Preview package' }).click();
	await expect(page.getByText('browser-test-skill', { exact: true })).toBeVisible();
	await page.locator('summary').filter({ hasText: 'Scientific data & analysis' }).click();
	await page.getByLabel('Data reduction', { exact: true }).check();
	await page.getByLabel('Technology tags').fill('python, hdf5');
	await page.getByRole('button', { name: 'Publish skill', exact: true }).click();
	await expect(page).toHaveURL(/\/skills\/[a-f0-9-]+$/);
	const skillPath = new URL(page.url()).pathname;
	await expect(page.getByRole('heading', { name: 'Explore HDF5 data' })).toBeVisible();
	expect(
		(await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze())
			.violations
	).toEqual([]);
	await page.getByRole('button', { name: 'Save', exact: true }).click();
	await expect(page.getByRole('button', { name: 'Saved', exact: true })).toBeVisible();
	await page.screenshot({ path: 'test-results/skill-desktop.png', fullPage: true });

	const guest = await browser.newContext();
	const anonymous = await guest.newPage();
	await anonymous.goto('/?q=HDF5&category=science');
	await expect(anonymous.getByRole('link', { name: 'browser-test-skill' })).toBeVisible();
	expect(
		(
			await new AxeBuilder({ page: anonymous })
				.withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
				.analyze()
		).violations
	).toEqual([]);
	await anonymous.screenshot({ path: 'test-results/explore-desktop.png', fullPage: true });
	const result = await guest.request.get(`${skillPath}/download?revision=1`);
	expect(result.ok()).toBe(true);
	expect(
		Buffer.from(
			unzipSync(new Uint8Array(await result.body()))['browser-test-skill/SKILL.md']
		).toString()
	).toBe(source);
	await anonymous.goto(skillPath);
	await expect(anonymous.getByRole('link', { name: 'Manage skill' })).toHaveCount(0);
	await anonymous.setViewportSize({ width: 390, height: 844 });
	await anonymous.screenshot({ path: 'test-results/skill-mobile.png', fullPage: true });
	expect(
		await anonymous.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)
	).toBe(true);
	await anonymous.goto('/');
	await anonymous.screenshot({ path: 'test-results/explore-mobile.png', fullPage: true });
	expect(
		await anonymous.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)
	).toBe(true);

	const attacker = await browser.newContext();
	await attacker.request.post('/register', {
		headers: { origin },
		form: { username: 'other-user', password: 'another-long-test-password' }
	});
	expect((await attacker.request.get(`${skillPath}/edit`)).status()).toBe(403);
	const unauthorized = await attacker.request.post(`${skillPath}/edit?/publish`, {
		headers: { origin },
		multipart: {
			expected: '1',
			category: 'python',
			file: { name: 'SKILL.md', mimeType: 'text/markdown', buffer: Buffer.from(source) }
		}
	});
	expect(await unauthorized.json()).toMatchObject({ type: 'failure', status: 403 });
	const archiveAttempt = await attacker.request.post(`${skillPath}/edit?/archive`, {
		headers: { origin },
		form: { archived: '1', expected: '1' }
	});
	expect(await archiveAttempt.json()).toMatchObject({ type: 'failure', status: 403 });
	const refreshAttempt = await attacker.request.post(`${skillPath}/edit?/refresh`, {
		headers: { origin },
		form: { expected: '1' }
	});
	expect(await refreshAttempt.json()).toMatchObject({ type: 'failure', status: 403 });
	const csrf = await page.request.post(`${skillPath}/edit?/archive`, {
		headers: { origin: 'https://outside.example' },
		form: { archived: '1', expected: '1' }
	});
	expect(csrf.status()).toBe(403);

	await page.goto(`${skillPath}/edit`);
	const updated = source.replace(
		'Read metadata before loading arrays.',
		'Read only the metadata and a small array slice.'
	);
	await page
		.locator('input[type=file]')
		.setInputFiles({ name: 'SKILL.md', mimeType: 'text/markdown', buffer: Buffer.from(updated) });
	await page.getByRole('button', { name: 'Publish revision' }).click();
	await expect(page.getByText('Revision 2', { exact: true }).first()).toBeVisible();
	const oldVersion = await guest.request.get(`${skillPath}/download?revision=1`);
	expect(
		Buffer.from(
			unzipSync(new Uint8Array(await oldVersion.body()))['browser-test-skill/SKILL.md']
		).toString()
	).toBe(source);
	await page.goto('/saved');
	await expect(page.getByRole('link', { name: 'browser-test-skill' })).toBeVisible();
	await page.goto(`${skillPath}/edit`);
	await page.getByRole('button', { name: 'Archive skill', exact: true }).click();
	await expect(page).toHaveURL(/\/my-skills$/);
	expect((await guest.request.get(`${skillPath}/download`)).status()).toBe(404);
	expect((await guest.request.get(`/api/v1${skillPath}`)).status()).toBe(404);
	await expect(page.getByText('Archived', { exact: true })).toBeVisible();
	await page.goto('/account');
	await page.getByLabel('Current password').fill('a-good-long-test-passphrase');
	await page.getByLabel('New password').fill('a-new-long-test-passphrase');
	await page.getByRole('button', { name: 'Change password' }).click();
	await expect(page.getByRole('status')).toContainText('Password changed');
	await page.getByRole('button', { name: 'Sign out', exact: true }).click();
	await expect(page).toHaveURL(origin + '/');
	await page.goto('/sign-in');
	await page.getByLabel('Username', { exact: true }).fill('owner');
	await page.getByLabel('Password', { exact: true }).fill('a-new-long-test-passphrase');
	await page.getByRole('button', { name: 'Sign in', exact: true }).click();
	await expect(page).toHaveURL(/\/my-skills$/);
	expect(errors).toEqual([]);
	await guest.close();
	await attacker.close();
});
