import type { CatalogDetails, Mcp } from '../types';
import { techniques } from '../taxonomy';
import { HubError } from './errors';

export const emptyDetails: CatalogDetails = {
	applicationType: 'skill',
	contexts: [],
	techniques: [],
	provenance: 'argonne',
	sourceUrl: '',
	upstreamAuthor: '',
	relevance: '',
	mcp: null
};

export function readDetails(value: string): CatalogDetails {
	return { ...emptyDetails, ...JSON.parse(value) };
}

export function validateDetails(details: Partial<CatalogDetails>): CatalogDetails {
	const form = new FormData();
	for (const key of [
		'applicationType',
		'provenance',
		'sourceUrl',
		'upstreamAuthor',
		'relevance'
	] as const)
		if (details[key]) form.set(key, details[key]);
	form.set('contexts', (details.contexts || []).join(','));
	for (const technique of details.techniques || []) form.append('technique', technique);
	if (details.mcp)
		for (const [key, value] of Object.entries(details.mcp))
			form.set(
				key === 'repository' ? 'mcpRepository' : key === 'documentation' ? 'mcpDocumentation' : key,
				value
			);
	return detailsFromForm(form);
}

export function detailsFromForm(form: FormData): CatalogDetails {
	const text = (key: string, max = 1000) => {
		const value = String(form.get(key) || '').trim();
		if (value.length > max) throw new HubError(`${key} is too long (maximum ${max} characters).`);
		return value;
	};
	const choice = <T extends string>(key: string, values: readonly T[], fallback: T): T => {
		const value = text(key) || fallback;
		if (!values.includes(value as T)) throw new HubError(`Choose a valid ${key}.`);
		return value as T;
	};
	const url = (key: string) => {
		const value = text(key, 2000);
		if (value) {
			try {
				const parsed = new URL(value);
				if (!['http:', 'https:'].includes(parsed.protocol) || parsed.username || parsed.password)
					throw new Error();
			} catch {
				throw new HubError(`${key} must be an HTTP(S) URL without credentials.`);
			}
		}
		return value;
	};
	const contexts = [
		...new Set(
			text('contexts', 400)
				.split(',')
				.map((v) => v.trim().toLowerCase())
				.filter(Boolean)
		)
	];
	if (contexts.length > 10 || contexts.some((v) => !/^[a-z0-9][a-z0-9 -]{0,39}$/.test(v)))
		throw new HubError('Use up to 10 short facility or beamline names.');
	const selected = [...new Set(form.getAll('technique').map(String))];
	if (selected.some((value) => !techniques.some(([id]) => id === value)))
		throw new HubError('Choose an available technique.');
	const applicationType = choice('applicationType', ['skill', 'mcp'], 'skill');
	let mcp: Mcp | null = null;
	if (applicationType === 'mcp') {
		mcp = {
			repository: url('mcpRepository'),
			documentation: url('mcpDocumentation'),
			deployment: choice('deployment', ['hosted', 'self-hosted', 'both', 'unknown'], 'unknown'),
			access: choice('access', ['public', 'internal', 'restricted', 'unknown'], 'unknown'),
			transport: choice('transport', ['http', 'stdio', 'sse', 'unknown'], 'unknown'),
			endpoint: url('endpoint'),
			authentication: text('authentication'),
			configuration: text('configuration', 8000),
			instructions: text('instructions', 12000),
			tools: text('tools', 4000)
		};
		if (!mcp.instructions) throw new HubError('Provide MCP connection or deployment instructions.');
		if (mcp.transport === 'stdio' && mcp.endpoint)
			throw new HubError('A stdio server uses a command, not an HTTP endpoint.');
	}
	return {
		applicationType,
		contexts,
		techniques: selected,
		provenance: choice('provenance', ['argonne', 'external', 'adapted'], 'argonne'),
		sourceUrl: url('sourceUrl'),
		upstreamAuthor: text('upstreamAuthor', 200),
		relevance: text('relevance'),
		mcp
	};
}
