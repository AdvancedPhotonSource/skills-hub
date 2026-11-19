import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Client, InMemoryTransport } from '@modelcontextprotocol/client';

const directory = mkdtempSync(join(tmpdir(), 'aps-hub-mcp-'));
process.env.DATA_DIR = directory;
const { db } = await import('../src/lib/server/db');
const { register } = await import('../src/lib/server/auth');
const { validatePackage } = await import('../src/lib/server/packages');
const { publish } = await import('../src/lib/server/catalog');
const { redeemDownloadGrant } = await import('../src/lib/server/grants');
const { buildMcpServer } = await import('../src/lib/server/mcp');
const { mintMcpToken, verifyAccessToken, revokeMcpToken, mcpScopes, bearerToken } =
	await import('../src/lib/server/mcp-auth');

const origin = 'https://hub.test';
let scientist: Awaited<ReturnType<typeof register>>;
let skillId: string;
const body = Buffer.from(
	'---\nname: ptycho-recon\ndescription: Reconstruct ptychography datasets\n---\n\n# Ptychography\n\nStart from the detector calibration.\n'
);

async function connect(scopes: readonly string[] = mcpScopes) {
	const [clientSide, serverSide] = InMemoryTransport.createLinkedPair();
	const server = buildMcpServer(scientist, origin, [...scopes]);
	const client = new Client({ name: 'test-client', version: '1.0.0' });
	await Promise.all([server.connect(serverSide), client.connect(clientSide)]);
	return { client, server };
}

const payload = async (client: Client, name: string, args: Record<string, unknown> = {}) => {
	const result = (await client.callTool({ name, arguments: args })) as {
		content: { text: string }[];
		isError?: boolean;
	};
	return { raw: result.content[0].text, isError: result.isError === true };
};

beforeAll(async () => {
	scientist = await register('mcp-scientist', 'long-passphrase-for-scientist', 'Scientist');
	skillId = publish(scientist, validatePackage([{ path: 'SKILL.md', data: body, mode: 0o644 }]), {
		categories: ['scattering'],
		tags: ['ptychography'],
		role: 'Researcher'
	});
});

afterAll(() => db.close());

describe('MCP access tokens', () => {
	it('round-trips a token and resolves the hub user', () => {
		const token = mintMcpToken(scientist.id, mcpScopes, 'test');
		const verified = verifyAccessToken(token);
		expect(verified?.user.id).toBe(scientist.id);
		expect(verified?.scopes).toEqual([...mcpScopes]);
	});

	it('rejects forged, expired and revoked tokens, and stores only a hash', () => {
		expect(verifyAccessToken('forged')).toBeNull();
		expect(verifyAccessToken('')).toBeNull();
		expect(verifyAccessToken('x'.repeat(5000))).toBeNull();

		const revoked = mintMcpToken(scientist.id);
		expect(revokeMcpToken(revoked)).toBe(true);
		expect(verifyAccessToken(revoked)).toBeNull();

		const expiring = mintMcpToken(scientist.id, mcpScopes, 'short', -1000);
		expect(verifyAccessToken(expiring)).toBeNull();

		const stored = mintMcpToken(scientist.id);
		const rows = db.prepare('SELECT token_hash FROM mcp_tokens').all() as {
			token_hash: string;
		}[];
		expect(rows.some((row) => row.token_hash === stored)).toBe(false);
	});

	it('reads only a well-formed bearer header', () => {
		expect(bearerToken('Bearer abc')).toBe('abc');
		expect(bearerToken('bearer abc')).toBeNull();
		expect(bearerToken('Basic abc')).toBeNull();
		expect(bearerToken(null)).toBeNull();
	});
});

describe('MCP tools', () => {
	it('advertises exactly the catalog tools', async () => {
		const { client, server } = await connect();
		const names = (await client.listTools()).tools.map((tool) => tool.name).sort();
		expect(names).toEqual(['get_skill', 'install_skill', 'read_skill_file', 'search_skills']);
		await server.close();
	});

	it('searches the catalog and returns summaries with hub links', async () => {
		const { client, server } = await connect();
		const { raw } = await payload(client, 'search_skills', { query: 'ptychography' });
		const found = JSON.parse(raw);
		expect(found.total).toBeGreaterThan(0);
		const entry = found.results.find((r: { id: string }) => r.id === skillId);
		expect(entry.name).toBe('ptycho-recon');
		expect(entry.url).toBe(`${origin}/skills/${skillId}`);
		// Summaries stay lean so an agent does not spend its context on unused fields.
		expect(entry.files).toBeUndefined();
		await server.close();
	});

	it('returns full detail and file listings for one entry', async () => {
		const { client, server } = await connect();
		const detail = JSON.parse((await payload(client, 'get_skill', { id: skillId })).raw);
		expect(detail.name).toBe('ptycho-recon');
		expect(detail.files.map((f: { path: string }) => f.path)).toContain('SKILL.md');
		const missing = await payload(client, 'get_skill', { id: 'no-such-entry' });
		expect(missing.isError).toBe(true);
		await server.close();
	});

	it('reads a packaged file and refuses paths outside the manifest', async () => {
		const { client, server } = await connect();
		const file = await payload(client, 'read_skill_file', { id: skillId, path: 'SKILL.md' });
		expect(file.raw).toContain('detector calibration');
		const escape = await payload(client, 'read_skill_file', {
			id: skillId,
			path: '../../../etc/passwd'
		});
		expect(escape.isError).toBe(true);
		await server.close();
	});

	it('mints a working download link that needs no session', async () => {
		const { client, server } = await connect();
		const install = JSON.parse((await payload(client, 'install_skill', { id: skillId })).raw);
		expect(install.downloadUrl).toContain(`${origin}/skills/${skillId}/download?revision=1&grant=`);
		const grant = new URL(install.downloadUrl).searchParams.get('grant')!;
		expect(redeemDownloadGrant(grant, skillId, 1)?.id).toBe(scientist.id);
		await server.close();
	});

	it('refuses a tool the token has no scope for', async () => {
		const { client, server } = await connect(['catalog:read']);
		const denied = await payload(client, 'install_skill', { id: skillId });
		expect(denied.isError).toBe(true);
		expect(denied.raw).toContain('skills:download');
		// The scopes it does hold still work.
		expect((await payload(client, 'search_skills', {})).isError).toBe(false);
		await server.close();
	});
});
