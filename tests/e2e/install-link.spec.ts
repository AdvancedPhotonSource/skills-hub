import { test, expect } from '@playwright/test';
import { zipSync, unzipSync } from 'fflate';
import { signIn } from './session';

const source =
	'---\nname: grant-link-skill\ndescription: Verify the install link works without a session\n---\n\n# Grant link\n\nCheck the download.\n';

test('the copied install link downloads with no session, and only with its own grant', async ({
	page,
	browser
}) => {
	await signIn(page.context(), 'grant-user', { displayName: 'Grant User' });
	await page.goto('/upload');
	// Every editor control is disabled until the form hydrates, and the file handler
	// only binds then. Waiting for the chooser to enable is waiting for hydration.
	const preview = page.getByRole('button', { name: 'Preview package' });
	await expect(page.getByRole('button', { name: /Choose a SKILL\.md or ZIP file/ })).toBeEnabled();
	await page.locator('input[type=file]').setInputFiles({
		name: 'skill.zip',
		mimeType: 'application/zip',
		buffer: Buffer.from(zipSync({ 'SKILL.md': Buffer.from(source) }))
	});
	await expect(preview).toBeEnabled();
	await preview.click();
	await expect(page.getByText('grant-link-skill', { exact: true })).toBeVisible();
	await page.locator('summary').filter({ hasText: 'Scientific data & analysis' }).click();
	await page.getByLabel('Data reduction', { exact: true }).check();
	await page.getByRole('button', { name: 'Publish skill', exact: true }).click();
	await expect(page).toHaveURL(/\/skills\/[a-f0-9-]+$/);

	// The install panel offers a link that carries its own authorization.
	const prompt = await page.locator('#install-text').inputValue();
	const link = prompt.match(/http:\/\/[^\s]*download\?revision=1&grant=[A-Za-z0-9_-]+/)?.[0];
	expect(link, 'install panel should show a granted download link').toBeTruthy();

	// A context with no cookies at all: what a package runner or an agent has.
	const anonymous = await browser.newContext();
	const response = await anonymous.request.get(link!);
	expect(response.status()).toBe(200);
	expect(response.headers()['content-type']).toBe('application/zip');
	const files = unzipSync(new Uint8Array(await response.body()));
	expect(Object.keys(files)).toContain('grant-link-skill/SKILL.md');

	// The perimeter is unchanged for anything that is not this exact grant.
	const stripped = link!.replace(/&grant=.*/, '');
	expect((await anonymous.request.get(stripped)).status()).toBe(401);
	expect((await anonymous.request.get(`${stripped}&grant=forged`)).status()).toBe(401);
	// A grant is pinned to one revision and cannot be moved to another.
	expect((await anonymous.request.get(link!.replace('revision=1', 'revision=2'))).status()).toBe(
		401
	);
	await anonymous.close();
});
