import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { zipSync } from 'fflate';
import { signIn } from './session';

// Equations from osa-alignment/SKILL.md at ae481e6d29ac86c5f68d386ac69b5f5771e02cff.
const source =
	String.raw`---
name: math-rendering-fixture
description: Inline and display mathematics
---
# Alignment equations

Inline: \(c=\sqrt{a^2-b^2}\) and $0\le E<1$.

\[
M_1 = \frac{d_{\mathrm{inner}} + d_{\mathrm{outer}}}{2\sqrt{a_o b_o}}
      + \lambda\left(1-\frac{C_{\mathrm{inner}}+C_{\mathrm{outer}}}{2}\right).
\]

$$
M_2 = \frac{1}{S}
      \frac{\sum_{p\in H} g_p(I_p-B)/\sum_{p\in H}g_p}
           {\sum_{p\in A}(I_p-B)/|A|}
      \left(1 + \lambda\,\frac{d}{r_i}\right),
\qquad
g_p = \exp\left[-\frac{\rho_p^2}{2(0.25)^2}\right],
\qquad
\rho_p^2 = (u_p/a_i)^2 + (v_p/b_i)^2.
$$

[More equations](references/math.md)
` + '\nInline code: `$x_i$`.\n\n```tex\n\\[not math in code\\]\n```\n';

test('typesets all delimiters in previews and file navigation without touching code', async ({
	page
}) => {
	const errors: string[] = [];
	page.on('pageerror', (error) => errors.push(error.message));
	let loads = 0;
	// Use the same pinned distribution as the CDN, without depending on CDN availability in CI.
	await page.route('https://cdn.jsdelivr.net/npm/**', async (route) => {
		const path = new URL(route.request().url()).pathname.slice('/npm/'.length);
		const match = path.match(/^((?:@[^/]+\/)?[^@/]+)@[^/]+\/(.+)$/)!;
		expect(['mathjax', '@mathjax/mathjax-newcm-font']).toContain(match[1]);
		if (match[1] === 'mathjax' && match[2] === 'tex-svg.js') loads++;
		await route.fulfill({
			contentType: 'application/javascript',
			body: await readFile(resolve('node_modules', match[1], match[2]))
		});
	});
	await signIn(page.context(), 'math-owner');
	await page.goto('/upload');
	expect(loads).toBe(0);
	await expect(page.locator('input[type=file]')).toBeEnabled();
	await page.locator('input[type=file]').setInputFiles({
		name: 'math.zip',
		mimeType: 'application/zip',
		buffer: Buffer.from(
			zipSync({
				'SKILL.md': Buffer.from(source),
				'references/math.md': Buffer.from('# More equations\n\n$$\\sum_{i=1}^n x_i$$\n')
			})
		)
	});
	await page.getByRole('button', { name: 'Preview package' }).click();
	await page.getByText('Review instructions and files', { exact: true }).click();
	await expect(page.locator('.package-preview mjx-container')).toHaveCount(4);
	await expect(page.locator('[data-mml-node="merror"]')).toHaveCount(0);
	await page.locator('summary').filter({ hasText: 'Scientific data & analysis' }).click();
	await page.getByLabel('Data reduction', { exact: true }).check();
	await page.getByRole('button', { name: 'Publish skill', exact: true }).click();
	await expect(page.locator('.file-body mjx-container')).toHaveCount(4);
	await expect(page.locator('.math-display mjx-container')).toHaveCount(2);
	await expect(page.locator('.prose code').filter({ hasText: '$x_i$' })).toBeVisible();
	await expect(page.locator('.prose pre')).toContainText('\\[not math in code\\]');
	await expect(page.locator('.prose code mjx-container')).toHaveCount(0);
	await page.setViewportSize({ width: 390, height: 844 });
	expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
	await page.getByRole('link', { name: 'Source', exact: true }).click();
	await expect(page.locator('.raw-source')).toContainText(String.raw`\frac{d_{\mathrm{inner}}`);
	await expect(page.locator('mjx-container')).toHaveCount(0);
	await page.getByRole('link', { name: 'Preview', exact: true }).click();
	await expect(page.locator('.file-body mjx-container')).toHaveCount(4);
	await page.getByRole('link', { name: 'More equations', exact: true }).click();
	await expect(page.locator('.file-body mjx-container')).toHaveCount(1);
	await expect(page.locator('[data-mml-node="merror"]')).toHaveCount(0);
	expect(loads).toBe(1);
	expect(errors).toEqual([]);
});

test('keeps readable LaTeX when the CDN cannot be reached', async ({ page }) => {
	await page.route('https://cdn.jsdelivr.net/npm/**', (route) => route.abort());
	await signIn(page.context(), 'math-offline');
	await page.goto('/upload');
	await expect(page.locator('input[type=file]')).toBeEnabled();
	await page.locator('input[type=file]').setInputFiles({
		name: 'SKILL.md',
		mimeType: 'text/markdown',
		buffer: Buffer.from(source)
	});
	await page.getByRole('button', { name: 'Preview package' }).click();
	await page.getByText('Review instructions and files', { exact: true }).click();
	await expect(page.getByRole('status')).toContainText('Showing LaTeX source instead.');
	await expect(page.locator('.math-display').first()).toContainText(String.raw`M_1 = \frac`);
});
