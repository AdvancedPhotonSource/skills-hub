import { test, expect } from '@playwright/test';
import { signIn } from './session';

for (const savedView of ['default', 'list', 'grid']) {
	test(`catalog view waits for hydration and respects ${savedView} preference`, async ({
		page
	}) => {
		await signIn(page.context(), `view-${savedView}`);
		if (savedView !== 'default') {
			await page.addInitScript((view) => localStorage.setItem('aps:view', view), savedView);
		}
		let resumeScripts!: () => void;
		const scriptsReady = new Promise<void>((resolve) => (resumeScripts = resolve));
		await page.route('**/*', async (route) => {
			if (route.request().resourceType() === 'script') await scriptsReady;
			await route.continue();
		});
		const list = page.getByRole('button', { name: 'List view', exact: true });
		const grid = page.getByRole('button', { name: 'Grid view', exact: true });
		try {
			await page.goto('/', { waitUntil: 'commit' });
			await expect(list).toBeVisible();
			await expect(list).toBeDisabled();
			await expect(grid).toBeDisabled();
		} finally {
			resumeScripts();
		}
		await expect(list).toBeEnabled();
		await expect(grid).toBeEnabled();
		await expect(grid).toHaveAttribute('aria-pressed', String(savedView !== 'list'));
		await grid.click();
		await expect(grid).toHaveAttribute('aria-pressed', 'true');
		await expect(page.locator('html')).toHaveAttribute('data-view', 'grid');
		expect(await page.evaluate(() => localStorage.getItem('aps:view'))).toBe('grid');
		await list.click();
		await expect(list).toHaveAttribute('aria-pressed', 'true');
		await expect(grid).toHaveAttribute('aria-pressed', 'false');
		await expect(page.locator('html')).toHaveAttribute('data-view', 'list');
		expect(await page.evaluate(() => localStorage.getItem('aps:view'))).toBe('list');
		if (savedView === 'default') {
			await page.reload();
			await expect(list).toBeEnabled();
			await expect(list).toHaveAttribute('aria-pressed', 'true');
			await expect(page.locator('html')).toHaveAttribute('data-view', 'list');
		}
	});
}
