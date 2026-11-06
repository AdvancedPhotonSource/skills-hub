import { test, expect } from '@playwright/test';
import { signIn } from './session';

const protectedPaths = [
	'/',
	'/categories',
	'/saved',
	'/my-skills',
	'/upload',
	'/account',
	'/docs/api',
	'/api/v1/skills',
	'/api/v1/categories',
	'/api/v1/skills/private-id',
	'/skills/private-id',
	'/skills/private-id/edit',
	'/skills/private-id/download?revision=1',
	'/skills/private-id/file?path=SKILL.md',
	'/discovery/SKILL.md',
	'/discovery/skill.zip',
	'/skill-install/prompt.md',
	'/__data.json',
	'/docs/api/__data.json',
	'/skills/private-id/__data.json',
	'/sign-in/../api/v1/skills'
];

test('every catalog surface is blocked server-side without an SSO session', async ({ request }) => {
	for (const path of protectedPaths) {
		const response = await request.get(path, { maxRedirects: 0 });
		expect(response.status(), path).toBe(401);
		expect(await response.json()).toEqual({ error: 'Argonne SSO sign-in is required.' });
		expect(response.headers()['cache-control']).toBe('private, no-store');
	}
	for (const method of ['HEAD', 'OPTIONS', 'POST']) {
		const response = await request.fetch('/api/v1/skills', {
			method,
			headers: { origin: 'http://127.0.0.1:4173' },
			maxRedirects: 0
		});
		expect(response.status(), method).toBe(401);
	}
	const passwordLogin = await request.post('/sign-in', {
		headers: { origin: 'http://127.0.0.1:4173' },
		form: { username: 'haskels', password: 'anything' }
	});
	expect(passwordLogin.status()).toBe(403);
	const register = await request.post('/register', {
		headers: { origin: 'http://127.0.0.1:4173' },
		form: { username: 'new-user', password: 'anything' }
	});
	expect(register.status()).toBe(403);
	const publish = await request.post('/upload?/publish', {
		headers: { origin: 'http://127.0.0.1:4173' },
		form: { applicationType: 'mcp' }
	});
	expect(publish.status()).toBe(401);
});

test('JavaScript, local storage, and forged identity headers cannot grant access', async ({
	page
}) => {
	await page.goto('/');
	await expect(page).toHaveURL(/\/sign-in$/);
	await expect(page.getByRole('heading', { name: 'Sign in with Argonne.' })).toBeVisible();
	await expect(page.getByLabel('Password', { exact: true })).toHaveCount(0);
	const status = await page.evaluate(async () => {
		localStorage.setItem('user', JSON.stringify({ isAdmin: true, verified: true }));
		document.cookie = 'aps_session=forged; path=/';
		return (
			await fetch('/api/v1/skills', { headers: { 'x-user': 'haskels', 'x-authenticated': 'true' } })
		).status;
	});
	expect(status).toBe(401);
	await page.goto('/categories');
	await expect(page).toHaveURL(/\/sign-in$/);
});

test('the access check works with JavaScript disabled', async ({ browser }) => {
	const context = await browser.newContext({ javaScriptEnabled: false });
	const page = await context.newPage();
	await page.goto('/');
	await expect(page).toHaveURL(/\/sign-in$/);
	await signIn(context, 'no-js-scientist');
	await page.goto('/');
	await expect(
		page.getByRole('heading', { name: 'Find the skill for your next task.' })
	).toBeVisible();
	await context.close();
});

for (const kind of ['local', 'expired'] as const) {
	test(`a ${kind} session cannot access the catalog even for a linked Argonne user`, async ({
		context
	}) => {
		await signIn(context, `blocked-${kind}`, {
			provider: kind === 'local' ? 'local' : 'entra',
			expired: kind === 'expired'
		});
		const response = await context.request.get('/api/v1/skills');
		expect(response.status()).toBe(401);
		const publish = await context.request.post('/upload?/publish', {
			headers: { origin: 'http://127.0.0.1:4173' },
			form: { applicationType: 'mcp' }
		});
		expect(publish.status()).toBe(401);
	});
}

test('an SSO session grants access; sign-out invalidates it on the server', async ({
	page,
	context
}) => {
	const token = await signIn(context, 'sso-scientist');
	expect((await page.request.get('/api/v1/skills')).status()).toBe(200);
	await page.goto('/account');
	await expect(page.getByRole('heading', { name: 'Linked Argonne account' })).toBeVisible();
	await expect(page.getByText('sso-scientist@anl.gov', { exact: true })).toBeVisible();
	await expect(page.getByRole('button', { name: 'Change password' })).toHaveCount(0);
	await page.getByRole('button', { name: 'Sign out', exact: true }).click();
	await expect(page).toHaveURL(/\/sign-in$/);
	const replay = await page.request.get('/api/v1/skills', {
		headers: { cookie: `aps_session=${token}` }
	});
	expect(replay.status()).toBe(401);
});

test('an unsolicited SSO callback cannot create a session', async ({ page }) => {
	await page.goto('/auth/callback/entra?code=unsolicited&state=unrelated');
	await expect(page).toHaveURL(/\/sign-in\?sso=failed$/);
	await expect(
		page.getByRole('alert').filter({ hasText: 'Argonne sign-in could not be completed' })
	).toBeVisible();
	expect((await page.context().cookies()).some((cookie) => cookie.name === 'aps_session')).toBe(
		false
	);
});
