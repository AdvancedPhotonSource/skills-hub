import { test, expect } from '@playwright/test';
import { unzipSync, zipSync } from 'fflate';
import AxeBuilder from '@axe-core/playwright';
import { signIn } from './session';

const source =
	'---\nname: browser-test-skill\ndescription: Explore HDF5 arrays and metadata with Python\nmetadata:\n  source-repository: https://github.com/AdvancedPhotonSource/lauelab\n---\n\n# Explore HDF5 data\n\nRead metadata before loading arrays.\n';
const origin = 'http://127.0.0.1:4173';

test('SSO users publish skills without approval, discover, download, protect ownership, and revise', async ({
	page,
	browser
}) => {
	const errors: string[] = [];
	page.on('pageerror', (error) => errors.push(error.message));
	await signIn(page.context(), 'owner', { displayName: 'Test Owner' });
	await page.goto('/');
	await expect(
		page.getByRole('heading', { name: 'Find the skill for your next task.' })
	).toBeVisible();
	await page.goto('/upload');
	expect(
		(await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze())
			.violations
	).toEqual([]);
	await page.locator('input[type=file]').setInputFiles({
		name: 'skill.zip',
		mimeType: 'application/zip',
		buffer: Buffer.from(
			zipSync({
				'SKILL.md': Buffer.from(source),
				'examples/analyze.py': Buffer.from('print("example")\n'),
				'references/notes.md': Buffer.from(
					'# Reference notes\n\nUse the measured detector geometry.\n'
				)
			})
		)
	});
	await page.getByRole('button', { name: 'Preview package' }).click();
	await expect(page.getByText('browser-test-skill', { exact: true })).toBeVisible();
	await page.locator('summary').filter({ hasText: 'Scientific data & analysis' }).click();
	await page.getByLabel('Data reduction', { exact: true }).check();
	await page.getByLabel('Technology tags').fill('python, hdf5');
	await page.getByRole('button', { name: 'Publish skill', exact: true }).click();
	await expect(page).toHaveURL(/\/skills\/[a-f0-9-]+$/);
	const skillPath = new URL(page.url()).pathname;
	const serverHtml = await (await page.request.get(skillPath)).text();
	expect(serverHtml).toContain(`${origin}${skillPath}/download?revision=1`);
	expect(serverHtml).not.toContain(`${origin}..`);
	await expect(page.getByRole('heading', { name: 'Explore HDF5 data' })).toBeVisible();
	const install = page.getByRole('region', { name: 'Use this skill' });
	await expect(install.getByRole('link', { name: /View on GitHub/ })).toHaveAttribute(
		'href',
		'https://github.com/AdvancedPhotonSource/lauelab'
	);
	await expect(page.getByLabel('Installation prompt')).toHaveValue(
		new RegExp(`${skillPath}/download\\?revision=1`)
	);
	const guide = await page.request.get('/skill-install/prompt.md');
	expect(guide.headers()['content-type']).toContain('text/markdown');
	expect(await guide.text()).toContain('complete named skill directory');
	await install.getByRole('button', { name: 'Command', exact: true }).click();
	for (const runner of ['npx', 'bunx', 'pnpm']) {
		await install.getByRole('button', { name: runner, exact: true }).click();
		await expect(page.getByLabel('Installation command')).toHaveValue(
			`${runner === 'pnpm' ? 'pnpm dlx' : runner} skills@1.7.4 add '${origin}${skillPath}/download?revision=1' --skill 'browser-test-skill'`
		);
	}
	await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
	await install.getByRole('button', { name: 'Copy command', exact: true }).click();
	await expect(install.getByRole('button', { name: 'Copied', exact: true })).toBeVisible();
	expect(await page.evaluate(() => navigator.clipboard.readText())).toContain(
		'pnpm dlx skills@1.7.4'
	);
	await install.getByRole('button', { name: 'Prompt', exact: true }).click();
	await expect(install.getByRole('button', { name: 'Copy prompt', exact: true })).toBeVisible();
	const files = page.getByRole('navigation', { name: 'Skill files' });
	await files.getByRole('link', { name: /analyze.py/ }).click();
	await expect(page.getByRole('region', { name: 'File source' })).toContainText('print("example")');
	await files.getByRole('link', { name: /SKILL.md/ }).click();
	expect(
		(await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze())
			.violations
	).toEqual([]);
	await page.getByRole('button', { name: 'Save', exact: true }).click();
	await expect(page.getByRole('button', { name: 'Saved', exact: true })).toBeVisible();
	await page.screenshot({ path: 'test-results/skill-desktop.png', fullPage: true });

	const guest = await browser.newContext();
	await signIn(guest, 'catalog-reader');
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
	await signIn(attacker, 'other-user');
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
	const deleteAttempt = await attacker.request.post(`${skillPath}/edit?/delete`, {
		headers: { origin },
		form: { expected: '1' }
	});
	expect(await deleteAttempt.json()).toMatchObject({ type: 'failure', status: 403 });
	const refreshAttempt = await attacker.request.post(`${skillPath}/edit?/refresh`, {
		headers: { origin },
		form: { expected: '1' }
	});
	expect(await refreshAttempt.json()).toMatchObject({ type: 'failure', status: 403 });
	const csrf = await page.request.post(`${skillPath}/edit?/delete`, {
		headers: { origin: 'https://outside.example' },
		form: { expected: '1' }
	});
	expect(csrf.status()).toBe(403);

	await page.goto(`${skillPath}/edit`);
	const updated = source.replace(
		'Read metadata before loading arrays.',
		'Read only the metadata and a small array slice.'
	);
	const reference = '# Reviewed sources\n\nhttps://example.org/beamline\n';
	await page.locator('input[type=file]').setInputFiles({
		name: 'skill.zip',
		mimeType: 'application/zip',
		buffer: Buffer.from(
			zipSync({ 'SKILL.md': Buffer.from(updated), 'references/sources.md': Buffer.from(reference) })
		)
	});
	await page.getByRole('button', { name: 'Save changes' }).click();
	await expect(
		page.getByText('Read only the metadata and a small array slice.', { exact: true })
	).toBeVisible();
	await expect(page.getByText('Revision 2', { exact: true })).toHaveCount(0);
	const oldVersion = await guest.request.get(`${skillPath}/download?revision=1`);
	expect(
		Buffer.from(
			unzipSync(new Uint8Array(await oldVersion.body()))['browser-test-skill/SKILL.md']
		).toString()
	).toBe(source);
	await page.goto('/saved');
	await expect(page.getByRole('link', { name: 'browser-test-skill' })).toBeVisible();
	await page.goto(`${skillPath}/edit`);
	await page.getByLabel('Application type').selectOption('mcp');
	await page
		.getByLabel('Connection / deployment instructions')
		.fill('Connect to the configured beamline MCP service.');
	await page.getByRole('button', { name: 'Save changes', exact: true }).click();
	await page.getByText('Supporting documentation', { exact: true }).click();
	const mcpFiles = page.getByRole('navigation', { name: 'MCP files' });
	await expect(mcpFiles.getByRole('link', { name: /SKILL.md/ })).toHaveCount(0);
	await mcpFiles.getByRole('link', { name: /sources.md/ }).click();
	await expect(page.getByRole('heading', { name: 'Reviewed sources' })).toBeVisible();
	const mcpZip = unzipSync(
		new Uint8Array(await (await guest.request.get(`${skillPath}/download`)).body())
	);
	expect(Object.keys(mcpZip)).toEqual([
		'browser-test-skill/README.md',
		'browser-test-skill/references/sources.md'
	]);
	expect(Buffer.from(mcpZip['browser-test-skill/references/sources.md']).toString()).toBe(
		reference
	);
	await page.goto(`${skillPath}/edit`);
	await page.getByRole('button', { name: 'Delete entry', exact: true }).click();
	await expect(page).toHaveURL(/\/my-skills$/);
	expect((await guest.request.get(`${skillPath}/download`)).status()).toBe(404);
	expect((await guest.request.get(`/api/v1${skillPath}`)).status()).toBe(404);
	expect((await guest.request.get(`${skillPath}/download?revision=1`)).status()).toBe(404);
	await expect(page.getByRole('link', { name: 'browser-test-skill', exact: true })).toHaveCount(0);
	await page.goto('/account');
	await expect(page.getByText('owner@anl.gov', { exact: true })).toBeVisible();
	await page.getByRole('button', { name: 'Sign out', exact: true }).click();
	await expect(page).toHaveURL(/\/sign-in$/);
	expect(errors).toEqual([]);
	await guest.close();
	await attacker.close();
});

test('SSO users publish MCPs without approval, with provenance, discovery, and type-specific display', async ({
	page
}) => {
	await signIn(page.context(), 'mcp-owner', { displayName: 'MCP Owner' });
	await page.goto('/upload');
	await page.getByLabel('Application type').selectOption('mcp');
	await page.getByLabel('Name', { exact: true }).fill('test-xrf-mcp');
	await page.getByLabel('Description', { exact: true }).fill('Analyze XRF maps at APS 2-ID-D.');
	await page.getByLabel('Repository', { exact: true }).fill('https://example.org/xrf-mcp');
	await page.getByLabel('Deployment', { exact: true }).selectOption('self-hosted');
	await page.getByLabel('Access', { exact: true }).selectOption('internal');
	await page.getByLabel('Transport', { exact: true }).selectOption('stdio');
	await expect(page.getByLabel('Description', { exact: true })).toHaveValue(
		'Analyze XRF maps at APS 2-ID-D.'
	);
	expect(
		JSON.parse(await page.getByLabel('Client configuration example').inputValue())
	).toMatchObject({
		mcpServers: { 'test-xrf-mcp': { command: '/absolute/path/to/server-command', args: [] } }
	});
	await expect(page.getByLabel('Connection / deployment instructions')).toHaveValue(
		/It launches the server process over stdio/
	);
	await page
		.getByLabel('Authentication requirements')
		.fill('No authentication is required for this local server.');
	await page
		.getByLabel('Tools and capabilities')
		.fill('inspect_map: accepts a file path and returns XRF metadata.');
	await page
		.getByLabel('Connection / deployment instructions')
		.fill('Install the package in your analysis environment and configure the client.');
	await page.getByLabel('Client configuration example').fill('{"command":"xrf-mcp"}');
	await page.getByRole('button', { name: 'Publish MCP', exact: true }).click();
	await expect(
		page.getByRole('status').filter({ hasText: 'Choose between one and five categories.' })
	).toBeVisible();
	await expect(page.getByLabel('Client configuration example')).toHaveValue(
		'{"command":"xrf-mcp"}'
	);
	await expect(page.getByLabel('Tools and capabilities')).toHaveValue(
		'inspect_map: accepts a file path and returns XRF metadata.'
	);
	await page.locator('summary').filter({ hasText: 'Scientific data & analysis' }).click();
	await page.getByLabel('Data reduction', { exact: true }).check();
	await page.getByLabel('Facility / beamline').fill('aps, 2-id-d');
	await page.getByLabel('X-ray fluorescence', { exact: true }).check();
	await page.getByLabel('Authorship').selectOption('external');
	await page.getByLabel('Original author / organization').fill('XRF project');
	await page.getByLabel('Original source URL').fill('https://example.org/xrf-mcp');
	await page.getByLabel('APS use case').fill('Analyze maps collected at APS 2-ID-D.');
	await page.getByRole('button', { name: 'Publish MCP', exact: true }).click();
	await expect(page).toHaveURL(/\/skills\/[a-f0-9-]+$/);
	const path = new URL(page.url()).pathname;
	await expect(page.getByRole('heading', { name: 'Deploy MCP' })).toBeVisible();
	await expect(page.getByRole('region', { name: 'Use this skill' })).toHaveCount(0);
	await expect(page.getByText('Maintained by MCP Owner', { exact: true })).toBeVisible();
	await expect(page.getByText('Tracking ref', { exact: true })).toHaveCount(0);
	const result = await (await page.request.get(`/api/v1${path}`)).json();
	expect(result.skill).toMatchObject({
		applicationType: 'mcp',
		provenance: 'external',
		contexts: ['aps', '2-id-d'],
		techniques: ['xrf']
	});
	expect(result.revision.files.map((file: { path: string }) => file.path)).toEqual(['README.md']);
	await page.getByRole('link', { name: 'Manage MCP', exact: true }).click();
	await expect(page.getByLabel('Connection / deployment instructions')).toHaveValue(
		'Install the package in your analysis environment and configure the client.'
	);
	await expect(page.getByLabel('Client configuration example')).toHaveValue(
		'{"command":"xrf-mcp"}'
	);
	await page
		.getByLabel('Connection / deployment instructions')
		.fill('Use the configured XRF environment and run xrf-mcp.');
	await page.getByRole('button', { name: 'Save changes', exact: true }).click();
	await expect(
		page.getByText('Use the configured XRF environment and run xrf-mcp.', { exact: true })
	).toBeVisible();
	expect((await (await page.request.get(`/api/v1${path}`)).json()).skill).toMatchObject({
		revision: 2,
		provenance: 'external',
		mcp: { transport: 'stdio' }
	});
	expect(
		(await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze())
			.violations
	).toEqual([]);
	await page.setViewportSize({ width: 390, height: 844 });
	expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
	await page.screenshot({ path: 'test-results/mcp-mobile.png', fullPage: true });
	await page.goto('/?type=skill&technique=xrf');
	await expect(page.getByRole('link', { name: 'test-xrf-mcp', exact: true })).toHaveCount(0);
	await page.goto('/?type=mcp&context=2-id-d&technique=xrf');
	await expect(page.getByRole('link', { name: 'test-xrf-mcp', exact: true })).toBeVisible();
	await page.locator('summary').filter({ hasText: 'Find with your agent' }).click();
	await page.getByLabel('What do you want to do?').fill('Analyze fluorescence maps.');
	await expect(page.getByRole('region', { name: 'Discovery prompt' })).toContainText(
		'Analyze fluorescence maps.'
	);
	const zip = await page.request.get('/discovery/skill.zip');
	expect(zip.ok()).toBe(true);
	expect(
		Buffer.from(
			unzipSync(new Uint8Array(await zip.body()))['aps-hub-discovery/SKILL.md']
		).toString()
	).toContain('name: aps-hub-discovery');
	expect((await page.request.get('/discovery/SKILL.md')).ok()).toBe(true);
});

test('MCP templates are prefilled and configuration changes immediately with transport', async ({
	page
}) => {
	await signIn(page.context(), 'mcp-template-author');
	await page.goto('/upload');
	await page.getByLabel('Application type').selectOption('mcp');
	const instructions = page.getByLabel('Connection / deployment instructions');
	const configuration = page.getByLabel('Client configuration example');
	await expect(page.getByText('Start with an editable template')).toHaveCount(0);
	await expect(page.getByRole('button', { name: /template/i })).toHaveCount(0);
	await expect(configuration).toHaveValue('');
	await expect(page.getByLabel('Description', { exact: true })).toHaveValue(/An MCP server for/);
	await expect(page.getByLabel('Authentication requirements')).toHaveValue(/Authentication method/);
	await expect(page.getByLabel('Tools and capabilities')).toHaveValue(/\[tool_name\]/);
	await expect(instructions).toHaveValue(/## Prerequisites/);
	await page.getByLabel('Name', { exact: true }).fill('template-mcp');
	await page.getByLabel('Hosted endpoint (if available)').fill('https://example.org/custom/mcp');
	await page.getByLabel('Deployment', { exact: true }).selectOption('hosted');
	await page.getByLabel('Transport', { exact: true }).selectOption('http');
	await expect(page).toHaveURL(/\/upload$/);
	expect(JSON.parse(await configuration.inputValue())).toEqual({
		mcpServers: { 'template-mcp': { type: 'http', url: 'https://example.org/custom/mcp' } }
	});
	await expect(instructions).toHaveValue(/Streamable HTTP/);
	await expect(instructions).not.toHaveValue(/## Deploy the server/);
	await page.getByLabel('Deployment', { exact: true }).selectOption('self-hosted');
	await expect(instructions).toHaveValue(/## Deploy the server/);
	await instructions.fill('My existing connection instructions.');
	await configuration.fill('{"custom":"edited config"}');
	await page.getByLabel('Transport', { exact: true }).selectOption('sse');
	await expect(instructions).toHaveValue('My existing connection instructions.');
	await expect(configuration).toHaveValue(/"type": "sse"/);
	await page.getByLabel('Transport', { exact: true }).selectOption('stdio');
	await expect(configuration).toHaveValue(/"command":/);
	await expect(configuration).not.toHaveValue(/"url":/);
	await page.getByLabel('Transport', { exact: true }).selectOption('unknown');
	await expect(configuration).toHaveValue('');
	await page.getByLabel('Transport', { exact: true }).selectOption('http');
	await expect(configuration).toHaveValue(/"type": "http"/);
	await configuration.fill('{"custom":"editable again"}');
	await page.getByLabel('Name', { exact: true }).fill('renamed-mcp');
	await expect(configuration).toHaveValue('{"custom":"editable again"}');
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
});
