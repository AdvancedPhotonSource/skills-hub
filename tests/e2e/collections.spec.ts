import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { unzipSync } from 'fflate';
import { signIn } from './session';

test('publish, browse, download, and manage a collection of skills and MCPs', async ({ page }) => {
	await signIn(page.context(), 'collection-owner', { displayName: 'Collection Owner' });
	const headers = { origin: 'http://127.0.0.1:4173' };
	const response = await page.request.post('/upload?/publish', {
		headers,
		multipart: {
			applicationType: 'skill',
			category: 'reduction',
			file: {
				name: 'SKILL.md',
				mimeType: 'text/markdown',
				buffer: Buffer.from(
					'---\nname: grouped-analysis\ndescription: Analyze scientific data with Python\n---\n# Analysis\nRead the metadata first.'
				)
			}
		}
	});
	expect(response.ok()).toBe(true);
	const search = await (await page.request.get('/api/v1/skills?q=grouped-analysis&exact=1')).json();
	const skillPath = `/skills/${search.skills[0].id}`;
	const mcpResponse = await page.request.post('/upload?/publish', {
		headers,
		form: {
			applicationType: 'mcp',
			category: 'reduction',
			name: 'grouped-mcp',
			description: 'Tools for the analysis workflow',
			instructions: 'Run the MCP with Python.',
			transport: 'stdio'
		}
	});
	expect(mcpResponse.ok()).toBe(true);
	await page.goto('/upload');
	await page.getByLabel('Application type', { exact: true }).selectOption('collection');
	await page.getByLabel('Collection title').fill('Scientific analysis collection');
	await page.getByLabel('Collection identifier').fill('scientific-analysis-collection');
	await page
		.getByLabel('Description', { exact: true })
		.fill('A shared toolkit for scientific analysis, with a skill and MCP shipped together.');
	await page
		.getByLabel('Linked repository')
		.fill('https://github.com/AdvancedPhotonSource/ptychodus');
	await page.getByRole('checkbox', { name: /grouped-analysis/ }).check();
	await page.getByRole('checkbox', { name: /grouped-mcp/ }).check();
	await page.locator('summary').filter({ hasText: 'Scientific data & analysis' }).click();
	await page.getByLabel('Data reduction', { exact: true }).check();
	await page.screenshot({ path: 'test-results/collection-publish.png', fullPage: true });
	await page.getByRole('button', { name: 'Publish collection', exact: true }).click();
	await expect(
		page.getByRole('heading', { name: 'Scientific analysis collection', exact: true })
	).toBeVisible();
	const collectionPath = new URL(page.url()).pathname;
	await expect(page.getByRole('heading', { name: '2 entries in this collection' })).toBeVisible();
	await expect(page.locator('.metadata')).toContainText('Collection Owner');
	await expect(
		page.locator('.detail-sidebar a[href="https://github.com/AdvancedPhotonSource/ptychodus"]')
	).toBeVisible();
	const zip = await page.request.get(`${collectionPath}/download`);
	expect(Object.keys(unzipSync(await zip.body()))).toEqual([
		'grouped-analysis/SKILL.md',
		'grouped-mcp/README.md'
	]);
	expect(
		(await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze())
			.violations
	).toEqual([]);
	await page.screenshot({ path: 'test-results/collection-detail-desktop.png', fullPage: true });
	await page.setViewportSize({ width: 390, height: 844 });
	expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
	await page.screenshot({ path: 'test-results/collection-detail-mobile.png', fullPage: true });
	await page.setViewportSize({ width: 1280, height: 900 });
	await page.goto('/');
	await page.getByRole('button', { name: 'Grid view', exact: true }).click();
	await expect(page.getByRole('button', { name: 'Grid view', exact: true })).toHaveAttribute(
		'aria-pressed',
		'true'
	);
	await expect(
		page.locator('.collection-row').filter({ hasText: 'Scientific analysis collection' })
	).toBeVisible();
	await expect(page.locator(`.skill-name[href="${skillPath}"]`)).toHaveCount(0);
	await page.screenshot({ path: 'test-results/collection-explore-desktop.png', fullPage: true });
	await page.goto(skillPath);
	await expect(
		page
			.locator('.page-head')
			.getByRole('link', { name: 'Scientific analysis collection', exact: true })
	).toBeVisible();
	let resumeScripts!: () => void;
	const scriptsReady = new Promise<void>((resolve) => (resumeScripts = resolve));
	await page.route('**/*', async (route) => {
		if (route.request().resourceType() === 'script') await scriptsReady;
		await route.continue();
	});
	try {
		await page.goto(`${collectionPath}/edit`, { waitUntil: 'commit' });
		await expect(page.getByRole('checkbox', { name: /grouped-analysis/ })).toBeChecked();
		await expect(page.getByLabel('Description', { exact: true })).toBeDisabled();
		await expect(page.getByRole('checkbox', { name: /grouped-analysis/ })).toBeDisabled();
		await expect(page.getByRole('button', { name: 'Save changes', exact: true })).toBeDisabled();
	} finally {
		resumeScripts();
	}
	await page.getByLabel('Description', { exact: true }).fill('An updated shared toolkit.');
	await page.getByRole('button', { name: 'Save changes', exact: true }).click();
	await expect(page).toHaveURL(collectionPath);
	await expect(page.locator('.detail-heading')).toContainText('An updated shared toolkit.');
});
