<script lang="ts">
	import { base } from '$app/paths';
	import { page } from '$app/state';
	import { onMount } from 'svelte';
	import {
		Braces,
		ArrowUpRight,
		ArrowRight,
		BookOpen,
		Play,
		Globe,
		Package,
		Search
	} from '@lucide/svelte';
	import CodeBlock from '$lib/components/CodeBlock.svelte';
	let { data } = $props();
	let ready = $state(false);
	onMount(() => {
		ready = true;
	});
	const root = $derived(new URL(`${base}/`, page.url).href.replace(/\/$/, ''));
	const languages = ['cURL', 'JavaScript', 'Python'] as const;
	let language = $state<(typeof languages)[number]>('cURL');
	let endpoint = $state<'search' | 'detail' | 'categories'>('search');
	let query = $state('');
	let skillId = $state('');
	const selectedId = $derived(skillId.trim() || data.exampleId);
	const requestPath = $derived(
		endpoint === 'categories'
			? '/api/v1/categories'
			: endpoint === 'detail'
				? `/api/v1/skills/${encodeURIComponent(selectedId)}`
				: `/api/v1/skills${query ? `?${new URLSearchParams({ q: query })}` : ''}`
	);
	const requestUrl = $derived(`${root}${requestPath}`);
	const exampleCode = $derived(
		language === 'cURL'
			? `curl --fail-with-body --silent --show-error ${JSON.stringify(requestUrl)} \\\n  -H "Accept: application/json"`
			: language === 'JavaScript'
				? `const response = await fetch(${JSON.stringify(requestUrl)});\nif (!response.ok) throw new Error(\`HTTP \${response.status}\`);\nconst data = await response.json();\nconsole.log(data);`
				: `import json\nfrom urllib.request import urlopen\n\nwith urlopen(${JSON.stringify(requestUrl)}, timeout=15) as response:\n    data = json.load(response)\nprint(json.dumps(data, indent=2))`
	);
	let loading = $state(false);
	let responseText = $state('');
	let responseStatus = $state(0);
	let responseUrl = $state('');
	let requestError = $state('');
	async function runRequest() {
		if (loading || (endpoint === 'detail' && !selectedId)) return;
		loading = true;
		requestError = '';
		responseText = '';
		responseStatus = 0;
		responseUrl = requestUrl;
		try {
			const response = await fetch(responseUrl, {
				headers: { Accept: 'application/json' },
				signal: AbortSignal.timeout(15000)
			});
			responseStatus = response.status;
			responseText = JSON.stringify(await response.json(), null, 2);
		} catch {
			requestError =
				'The request could not complete or did not return JSON. Check your connection to the hub and try again.';
		} finally {
			loading = false;
		}
	}
	const parameters = [
		[
			'type',
			'skill | mcp',
			'Application type. MCP records include connection and deployment metadata.'
		],
		['context', 'string', 'One facility or beamline, such as aps or 2-id-d.'],
		[
			'technique',
			'string',
			'Scientific technique ID: xrf, ptychography, tomography, saxs, diffraction, laue, or spectroscopy.'
		],
		[
			'provenance',
			'argonne | external | adapted',
			'Authorship, independent of upload/import method.'
		],
		[
			'q',
			'string',
			'Optional search text, trimmed to 200 characters. Unquoted words match prefixes; all terms must match. Double quotes group a phrase.'
		],
		['exact', '1', 'With q, match the complete skill name instead of full-text search.'],
		[
			'category',
			'string',
			'Category ID, such as scattering or science. A parent includes its child categories.'
		],
		['tag', 'string', 'One exact technology tag, such as python or hdf5.'],
		[
			'role',
			'string',
			'Exact role label: Beamline scientist, Researcher, Software engineer, Controls engineer, or System administrator.'
		],
		[
			'author',
			'string',
			'Submitter or maintainer username (such as haskels), or upstream publisher.'
		],
		[
			'repository',
			'owner/repo',
			'Imported-source repository, such as AdvancedPhotonSource/ptychodus. This does not match related-project or MCP repository links.'
		],
		['origin', 'imported | uploaded', 'Filter repository imports or local contributions.'],
		[
			'days',
			'7 | 30 | 90 | 365',
			'Skills updated within this many days. Other values leave the date unrestricted.'
		],
		[
			'sort',
			'relevance | recent | downloads',
			'Default: relevance. Without a full-text query, relevance uses newest updates first.'
		],
		['page', 'integer', '1-based page; default 1. Results are fixed at 20 per page.']
	];
	const exampleId = $derived(data.exampleId || 'SKILL_ID');
	const downloadCode = $derived(
		`curl --fail --location "${root}/skills/${exampleId}/download?revision=1" \\\n  --output skill-r1.zip`
	);
</script>

<svelte:head
	><title>API Docs · APS Skills Hub</title><meta
		name="description"
		content="Explore the APS Skills Hub read API: search, skill details, categories, and immutable downloads, with runnable examples."
	/></svelte:head
>

<div class="docs-hero">
	<div class="shell">
		<div class="eyebrow">
			<Braces size={17} /> Developer reference <span class="badge">v1</span>
		</div>
		<h1>Catalog API documentation</h1>
		<p>
			Find skills and MCPs, inspect their provenance, and retrieve packages or connection details.
		</p>
		<div class="hero-links">
			<a class="button primary" href="#playground"><Play size={15} />Try a request</a><a
				class="button"
				href="#endpoints"><BookOpen size={15} />Explore endpoints</a
			>
		</div>
	</div>
</div>
<div class="shell docs-layout">
	<aside class="docs-nav">
		<nav aria-label="API documentation">
			<strong>On this page</strong>
			<a href="#overview">Getting started</a><a href="#endpoints">Endpoints</a><a href="#search"
				>Search skills</a
			><a href="#detail">Skill details</a><a href="#categories">Categories</a><a href="#downloads"
				>Download packages</a
			><a href="#playground">Examples & playground</a><a href="#errors">Errors & behavior</a>
		</nav>
	</aside>
	<div class="docs-content">
		<section id="overview">
			<div class="section-kicker">01 / Getting started</div>
			<h2>A small, read-only REST API</h2>
			<p>
				The API serves the same local catalog as the website. Search, details, and categories return
				JSON. No account, API key, or authorization header is required for these reads.
			</p>
			<div class="overview-cards">
				<div>
					<Globe size={19} />
					<h3>Available on your network</h3>
					<p>
						Use this hub’s address from an environment that can reach it. The deployed hub is
						intended for Argonne networks and VPN.
					</p>
				</div>
				<div>
					<Package size={19} />
					<h3>Complete local packages</h3>
					<p>
						Browsing and downloads use stored revisions. They do not need a live connection to
						GitHub or SkillsMP.
					</p>
				</div>
			</div>
			<CodeBlock label="Base URL" code={`${root}/api/v1`} />
		</section>
		<section id="endpoints">
			<div class="section-kicker">02 / Reference</div>
			<h2>Endpoints at a glance</h2>
			<div class="endpoint-list">
				{#each [['#search', '/api/v1/skills', 'Search and filter the catalog'], ['#detail', '/api/v1/skills/:id', 'Inspect a skill and its latest revision'], ['#categories', '/api/v1/categories', 'Browse the category tree and counts'], ['#downloads', '/skills/:id/download', 'Download an immutable package']] as [href, path, description]}
					<a {href}
						><span class="method">GET</span><span
							><code>{path}</code><small>{description}</small></span
						><ArrowRight size={16} /></a
					>
				{/each}
			</div>
		</section>
		<section id="search">
			<div class="endpoint-heading">
				<span class="method">GET</span>
				<h2>Search skills</h2>
			</div>
			<code class="route">/api/v1/skills</code>
			<p>
				Omit filters to browse all active entries. Combine parameters to narrow results; pagination
				returns up to 20 entries per page. Existing <code>/skills</code> routes serve both application
				types.
			</p>
			<!-- svelte-ignore a11y_no_noninteractive_tabindex (Scrollable table needs keyboard focus.) -->
			<div class="table-scroll" tabindex="0" role="region" aria-label="Search parameters">
				<table>
					<thead><tr><th>Parameter</th><th>Values</th><th>Description</th></tr></thead><tbody
						>{#each parameters as [name, type, description]}<tr
								><td><code>{name}</code></td><td>{type}</td><td>{description}</td></tr
							>{/each}</tbody
					>
				</table>
			</div>
			<h3>Response envelope</h3>
			<CodeBlock
				label="Search response structure"
				code={'{\n  "skills": [],\n  "total": 0,\n  "page": 1,\n  "pages": 0,\n  "query": ""\n}'}
			/>
			<p class="caption">
				An empty result is still HTTP 200. Each item in <code>skills</code> is a skill or MCP
				record;
				<code>total</code>
				counts all matches and <code>pages</code> is the total number of pages. Continue until
				<code>page &gt;= pages</code>.
			</p>
		</section>
		<section id="detail">
			<div class="endpoint-heading">
				<span class="method">GET</span>
				<h2>Skill details</h2>
			</div>
			<code class="route">/api/v1/skills/:id</code>
			<p>
				Use the <code>id</code> returned by search. The response contains <code>skill</code> and
				<code>revision</code> objects. This endpoint always returns the latest revision.
			</p>
			<!-- svelte-ignore a11y_no_noninteractive_tabindex (Scrollable table needs keyboard focus.) -->
			<div class="table-scroll" tabindex="0" role="region" aria-label="Detail response fields">
				<table>
					<thead><tr><th>Object</th><th>Contents</th></tr></thead><tbody>
						<tr
							><td><code>skill</code></td><td
								>ID, name, description, categories, tags, role, license, compatibility, revision
								number, download count, example task, and updatedAt.</td
							></tr
						>
						<tr
							><td
								><code>skill.ownerId</code><br /><code>username</code>, <code>displayName</code></td
							><td>Original hub submitter’s ID, username, and display name.</td></tr
						>
						<tr
							><td
								><code>skill.maintainerId</code>, <code>maintainerName</code>,
								<code>maintainerUsername</code></td
							><td
								>Employee maintaining this entry, separately from its submitter and upstream author.</td
							></tr
						>
						<tr
							><td
								><code>applicationType</code>, <code>contexts</code>, <code>techniques</code>,
								<code>provenance</code>, <code>mcp</code></td
							><td
								>Structured catalog metadata on the skill record. MCP metadata includes deployment,
								access, transport, endpoint, authentication requirements, configuration, tools, and
								instructions; it is null for skills. Each revision snapshots these fields in <code
									>revision.details</code
								>.</td
							></tr
						>
						<tr
							><td><code>revision</code></td><td
								>Revision ID and number, creation time, package checksum, version, name,
								description, license, compatibility, and file manifest.</td
							></tr
						>
						<tr
							><td><code>revision.files</code></td><td
								>Each file’s relative path, size in bytes, and SHA-256 hash.</td
							></tr
						>
						<tr
							><td><code>source</code></td><td
								>Present on both objects. Imported entries include repository, directory, tracked
								ref, exact commit, commit date, upstream author, and license paths. Local
								contributions have <code>null</code>.</td
							></tr
						>
					</tbody>
				</table>
			</div>
			<p class="caption">
				The revision checksum identifies the package manifest; it is not the hash of the downloaded
				ZIP. Use each file’s <code>sha256</code> to verify its bytes.
			</p>
		</section>
		<section id="categories">
			<div class="endpoint-heading">
				<span class="method">GET</span>
				<h2>Categories</h2>
			</div>
			<code class="route">/api/v1/categories</code>
			<p>
				Returns <code>{'{ "categories": [...] }'}</code>. Each category has <code>id</code>,
				<code>name</code>, <code>parent</code>, and <code>count</code>. Top-level categories have a
				null parent; their counts include child categories. A skill can belong to several
				categories, so counts should not be summed to calculate catalog size.
			</p>
			<a class="text-link" href={`${base}/categories`}
				>Browse category names <ArrowUpRight size={14} /></a
			>
		</section>
		<section id="downloads">
			<div class="endpoint-heading">
				<span class="method">GET</span>
				<h2>Download packages</h2>
			</div>
			<code class="route">/skills/:id/download?revision=N</code>
			<p>
				Returns a ZIP attachment containing the complete named skill folder. Set <code
					>revision</code
				> to the positive integer from the detail response to keep the download pinned. Omit it for the
				latest version.
			</p>
			<CodeBlock label="Download a specific revision" code={downloadCode} />
			<p class="caption">
				This example selects revision 1{data.exampleName
					? ` of ${data.exampleName}`
					: '; replace SKILL_ID with a search result ID'}. Successful ZIP requests increment the
				skill’s download count.
			</p>
			<h3>Retrieve one file</h3>
			<code class="route">/skills/:id/file?revision=N&amp;path=SKILL.md</code>
			<p>
				Returns the original file as a binary attachment. URL-encode companion paths such as <code
					>references/sources.md</code
				>. Keep the same revision when reading files from a package.
			</p>
		</section>
		<section id="playground">
			<div class="section-kicker">03 / Try it</div>
			<h2>Examples & playground</h2>
			<p>
				Choose an endpoint, copy an example, or run a read request against this hub. The response is
				formatted below.
			</p>
			<div class="playground">
				<form
					onsubmit={(event) => {
						event.preventDefault();
						void runRequest();
					}}
				>
					<div class="request-fields">
						<label
							>Endpoint<select bind:value={endpoint} disabled={!ready}
								><option value="search">Search skills</option><option value="detail"
									>Skill details</option
								><option value="categories">Categories</option></select
							></label
						>
						{#if endpoint === 'search'}<label
								>Search query <span>(optional)</span><input
									disabled={!ready}
									bind:value={query}
									placeholder="Try GSAS or browser"
									maxlength="200"
								/></label
							>{:else if endpoint === 'detail'}<label
								>Skill ID<input
									disabled={!ready}
									bind:value={skillId}
									placeholder={data.exampleId || 'Paste an ID from search'}
									required={!data.exampleId}
								/></label
							>{/if}
					</div>
					<div class="request-bar">
						<span class="method">GET</span><code>{requestPath}</code><button
							class="button primary small"
							disabled={!ready || loading || (endpoint === 'detail' && !selectedId)}
							><Play size={14} />{loading ? 'Loading…' : 'Run request'}</button
						>
					</div>
				</form>
				<div class="language-picker" role="group" aria-label="Example language">
					{#each languages as option}<button
							aria-pressed={language === option}
							disabled={!ready}
							onclick={() => (language = option)}>{option}</button
						>{/each}
				</div>
				<CodeBlock label={`${language} example`} code={exampleCode} />
				<div class="response-area" aria-busy={loading}>
					{#if requestError}<p class="notice" role="alert">
							{requestError}
						</p>{:else if responseText}<div class="response-heading">
							<h3>Response</h3>
							<span class="badge" class:failed={responseStatus >= 400} role="status"
								>HTTP {responseStatus}</span
							>
						</div>
						<p class="response-url">{responseUrl}</p>
						<CodeBlock label="JSON response" code={responseText} />{:else}<p
							class="response-placeholder"
						>
							<Search size={17} />{loading
								? 'Fetching your response…'
								: 'Run a request to inspect the live JSON response.'}
						</p>{/if}
				</div>
			</div>
		</section>
		<section id="errors">
			<div class="section-kicker">04 / Integration notes</div>
			<h2>Errors & behavior</h2>
			<p>A missing or archived skill returns HTTP 404 from the public detail endpoint:</p>
			<CodeBlock
				label="Detail error response · HTTP 404"
				code={'{\n  "error": "Skill not found."\n}'}
			/>
			<ul>
				<li>
					Search returns an empty list when no skills match. Unknown filters can produce no matches;
					unsupported options may be ignored or normalized. Use the documented values rather than
					expecting parameter-validation errors.
				</li>
				<li>
					File and ZIP routes return HTTP 400 for an invalid revision and 404 for a missing skill,
					revision, or file. Their error bodies follow SvelteKit content negotiation; check HTTP
					status before interpreting a body as a package.
				</li>
				<li>
					There are no API keys or per-account read quotas in the current application. Use
					pagination and cache results where appropriate. Deployment proxies may apply their own
					access rules.
				</li>
				<li>
					The API is served from the hub’s origin, without cross-origin browser access headers.
					Same-origin browser integrations and network-reachable server clients can use it directly.
				</li>
				<li>
					Publishing and account management use the website’s authenticated forms. This reference
					describes the public read API.
				</li>
			</ul>
		</section>
	</div>
</div>

<style>
	.docs-hero {
		background: linear-gradient(115deg, #f2f7ff, #f6f2fb);
		border-bottom: 1px solid var(--line);
		padding: 48px 0;
	}
	.docs-hero h1 {
		font-size: clamp(30px, 4vw, 43px);
		margin: 14px 0;
		letter-spacing: -1.4px;
	}
	.docs-hero p {
		color: var(--muted);
		max-width: 600px;
	}
	.hero-links {
		display: flex;
		flex-wrap: wrap;
		gap: 12px;
		margin-top: 24px;
	}
	.docs-layout {
		display: grid;
		grid-template-columns: 190px minmax(0, 1fr);
		gap: 55px;
		padding-block: 44px 64px;
	}
	.docs-nav nav {
		display: flex;
		flex-direction: column;
		align-items: stretch;
		gap: 5px;
		position: sticky;
		top: 24px;
		font-size: 12px;
	}
	.docs-nav strong {
		color: #384e6e;
		margin-bottom: 10px;
	}
	.docs-nav a {
		color: var(--muted);
		padding: 6px 10px;
		border-left: 2px solid var(--line);
	}
	.docs-nav a:hover {
		color: var(--blue);
		background: var(--blue-light);
		border-color: var(--blue);
		text-decoration: none;
	}
	.docs-content {
		min-width: 0;
		max-width: 880px;
	}
	section {
		scroll-margin-top: 25px;
		margin-bottom: 44px;
	}
	section + section {
		border-top: 1px solid var(--line);
		padding-top: 32px;
	}
	.section-kicker {
		color: #70429c;
		font:
			11px ui-monospace,
			monospace;
		margin-bottom: 12px;
	}
	h2 {
		font-size: 25px;
		margin: 0 0 13px;
	}
	h3 {
		font-size: 14px;
		margin: 24px 0 11px;
	}
	p,
	li {
		font-size: 14px;
		line-height: 1.85;
		color: #52647d;
	}
	li + li {
		margin-top: 12px;
	}
	code {
		font-family: ui-monospace, monospace;
		font-size: 0.9em;
		overflow-wrap: anywhere;
	}
	p code,
	td code {
		color: #304d70;
		background: #eff4fa;
		padding: 2px 4px;
		border-radius: 4px;
	}
	.overview-cards {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 15px;
		margin: 24px 0;
	}
	.overview-cards > div {
		border: 1px solid var(--line);
		background: #f8fafd;
		border-radius: 10px;
		padding: 20px;
	}
	.overview-cards :global(svg) {
		color: #226a5a;
	}
	.overview-cards h3 {
		margin-top: 10px;
	}
	.overview-cards p {
		font-size: 12px;
		margin: 0;
	}
	.endpoint-list {
		border: 1px solid var(--line);
		border-radius: 10px;
		overflow: hidden;
	}
	.endpoint-list a {
		display: flex;
		align-items: center;
		gap: 16px;
		padding: 16px 20px;
		color: #304d70;
	}
	.endpoint-list a + a {
		border-top: 1px solid var(--line);
	}
	.endpoint-list a:hover {
		background: #f8fafd;
		text-decoration: none;
	}
	.endpoint-list small {
		display: block;
		font-size: 12px;
		color: var(--muted);
		margin-top: 4px;
	}
	.endpoint-list a > :global(svg) {
		margin-left: auto;
		flex-shrink: 0;
	}
	.method {
		display: inline-block;
		font:
			600 10px ui-monospace,
			monospace;
		border-radius: 5px;
		background: #eaf5f0;
		color: #226a5a;
		padding: 6px 9px;
		flex-shrink: 0;
	}
	.endpoint-heading {
		display: flex;
		align-items: center;
		gap: 12px;
		margin-bottom: 12px;
	}
	.endpoint-heading h2 {
		margin: 0;
	}
	.route {
		display: block;
		color: #53647c;
		margin-bottom: 16px;
		font-size: 13px;
	}
	.table-scroll {
		overflow: auto;
		margin: 22px 0;
		border: 1px solid var(--line);
		border-radius: 9px;
	}
	table {
		width: 100%;
		border-collapse: collapse;
		font-size: 12px;
	}
	th {
		text-align: left;
		background: #f3f6fb;
		color: #3c5271;
		font-weight: 600;
	}
	td,
	th {
		padding: 13px 15px;
		vertical-align: top;
	}
	td {
		border-top: 1px solid var(--line);
		color: #52647d;
	}
	td:first-child {
		min-width: 120px;
	}
	.caption {
		font-size: 12px;
		margin-top: 12px;
	}
	.text-link {
		display: inline-flex;
		align-items: center;
		gap: 7px;
		font-size: 13px;
	}
	.playground {
		border: 1px solid #dce1f0;
		border-top: 3px solid #7859b3;
		border-radius: 12px;
		padding: 24px;
		background: #fafbfe;
	}
	.request-fields {
		display: grid;
		grid-template-columns: 1fr 1.4fr;
		gap: 16px;
	}
	label {
		display: flex;
		flex-direction: column;
		gap: 7px;
		font-size: 12px;
		color: #384e6e;
	}
	label span {
		display: contents;
		color: var(--muted);
	}
	input,
	select {
		width: 100%;
		font-size: 12px;
	}
	.request-bar {
		display: flex;
		align-items: center;
		gap: 10px;
		margin: 20px 0;
	}
	.request-bar code {
		flex: 1;
		min-width: 0;
		font-size: 11px;
		color: #53647c;
	}
	.request-bar button {
		flex-shrink: 0;
	}
	.language-picker {
		display: flex;
		gap: 7px;
		margin-bottom: 12px;
	}
	.language-picker button {
		padding: 6px 12px;
		font-size: 12px;
		color: #53647c;
		background: #fff;
		border: 1px solid #dbe2ea;
	}
	.language-picker button[aria-pressed='true'] {
		color: #6943a0;
		background: #f1eafa;
		border-color: #c8b4e0;
	}
	.response-heading {
		display: flex;
		align-items: center;
		gap: 12px;
		margin-top: 24px;
	}
	.response-heading h3 {
		margin: 0;
	}
	.response-heading .badge {
		color: #226a5a;
		background: #eaf5f0;
	}
	.response-heading .failed {
		color: #973746;
		background: #fceef0;
	}
	.response-url {
		font-size: 11px;
		overflow-wrap: anywhere;
		margin: 8px 0 12px;
	}
	.response-placeholder {
		display: flex;
		align-items: center;
		gap: 10px;
		font-size: 12px;
		margin: 20px 0 0;
	}
	@media (max-width: 900px) {
		.docs-layout {
			grid-template-columns: 150px minmax(0, 1fr);
			gap: 25px;
		}
		.request-fields {
			grid-template-columns: 1fr;
		}
		.request-bar {
			flex-wrap: wrap;
		}
		.request-bar button {
			margin-left: auto;
		}
	}
	@media (max-width: 650px) {
		.docs-layout {
			display: block;
			padding-top: 25px;
		}
		.docs-nav {
			margin-bottom: 30px;
		}
		.docs-nav nav {
			position: static;
			flex-direction: row;
			flex-wrap: wrap;
			gap: 4px 10px;
		}
		.docs-nav strong {
			width: 100%;
		}
		.docs-nav a {
			padding: 4px 8px;
		}
		.docs-hero {
			padding: 32px 0;
		}
		.overview-cards {
			grid-template-columns: 1fr;
		}
		.playground {
			padding: 16px;
		}
		.endpoint-list a {
			padding: 15px 12px;
			gap: 10px;
		}
		h2 {
			font-size: 22px;
		}
	}
</style>
