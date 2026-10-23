import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test('API docs link, runnable examples, formatted responses, and mobile access', async ({
	page
}) => {
	const errors: string[] = [];
	page.on('pageerror', (error) => errors.push(error.message));
	const serverHtml = await (await page.request.get('/docs/api')).text();
	expect(serverHtml).toContain('http://127.0.0.1:4173/api/v1');
	expect(serverHtml).not.toContain('http://127.0.0.1:4173..');
	await page.goto('/');
	await page.getByRole('link', { name: 'API Docs', exact: true }).click();
	await expect(page).toHaveURL(/\/docs\/api$/);
	await expect(page.getByRole('heading', { name: 'Catalog API documentation' })).toBeVisible();
	await page.getByRole('link', { name: 'Try a request' }).click();
	await page.getByLabel('Search query').fill('no-such-skill-for-api-docs');
	await page.getByRole('button', { name: 'Run request', exact: true }).click();
	const response = page.getByRole('region', { name: 'JSON response', exact: true });
	await expect(response).toContainText('"total": 0');
	expect(JSON.parse(await response.innerText())).toMatchObject({
		skills: [],
		total: 0,
		page: 1,
		pages: 0,
		query: 'no-such-skill-for-api-docs'
	});
	await page.getByRole('combobox', { name: 'Endpoint', exact: true }).selectOption('categories');
	await page.getByRole('button', { name: 'Run request', exact: true }).click();
	await expect(response).toContainText('"categories"');
	expect(JSON.parse(await response.innerText()).categories).toEqual(
		expect.arrayContaining([
			expect.objectContaining({ id: 'science', parent: null, count: expect.any(Number) })
		])
	);
	await page.getByRole('button', { name: 'JavaScript', exact: true }).click();
	await expect(page.getByRole('region', { name: 'JavaScript example', exact: true })).toContainText(
		'/api/v1/categories'
	);
	await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
	await page.getByRole('button', { name: 'Copy JavaScript example', exact: true }).click();
	expect(await page.evaluate(() => navigator.clipboard.readText())).toContain(
		'await response.json()'
	);
	await page.getByRole('button', { name: 'Python', exact: true }).click();
	await expect(page.getByRole('region', { name: 'Python example', exact: true })).toContainText(
		'from urllib.request import urlopen'
	);
	await page.getByRole('combobox', { name: 'Endpoint', exact: true }).selectOption('detail');
	await page.getByLabel('Skill ID', { exact: true }).fill('missing-skill');
	await page.getByRole('button', { name: 'Run request', exact: true }).click();
	await expect(page.getByRole('status').filter({ hasText: 'HTTP 404' })).toBeVisible();
	await expect(response).toContainText('"error": "Skill not found."');
	for (const width of [1280, 390]) {
		await page.setViewportSize({ width, height: 844 });
		expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
			true
		);
		expect(
			(await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze())
				.violations
		).toEqual([]);
	}
	await page.route('**/api/v1/skills/missing-skill', (route) => route.abort());
	await page.getByRole('button', { name: 'Run request', exact: true }).click();
	await expect(page.getByRole('alert')).toContainText('The request could not complete');
	expect(errors).toEqual([]);
});
