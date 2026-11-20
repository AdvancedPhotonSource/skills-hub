import { test, expect } from '@playwright/test';
import { signIn } from './session';

// The manual configuration is revealed by client-side state, so before hydration
// the toggle would silently swallow a click. It stays disabled until the handler
// is bound, which also makes the click wait for hydration instead of being lost.
test('the connect panel reveals manual configuration only once it is hydrated', async ({
	page
}) => {
	await signIn(page.context(), 'mcp-panel-hydration');
	let resumeScripts!: () => void;
	const scriptsReady = new Promise<void>((resolve) => (resumeScripts = resolve));
	await page.route('**/*', async (route) => {
		if (route.request().resourceType() === 'script') await scriptsReady;
		await route.continue();
	});
	const toggle = page.getByRole('button', { name: /configuration for other assistants/ });
	try {
		await page.goto('/', { waitUntil: 'commit' });
		await page.locator('summary').filter({ hasText: 'Connect your agent' }).click();
		await expect(toggle).toBeVisible();
		await expect(toggle).toBeDisabled();
	} finally {
		resumeScripts();
	}
	await expect(toggle).toBeEnabled();
	await toggle.click();
	await expect(toggle).toHaveAttribute('aria-expanded', 'true');
	await expect(page.getByRole('region', { name: 'MCP server configuration' })).toContainText(
		'"url": "http://127.0.0.1:4173/mcp"'
	);
});
