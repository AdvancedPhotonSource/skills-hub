<script lang="ts">
	import type { Mcp } from '$lib/types';
	import CodeBlock from './CodeBlock.svelte';
	import SaveButton from './SaveButton.svelte';
	let { mcp, id }: { mcp: Mcp; id: string } = $props();
	const deployments = {
		hosted: 'Existing hosted service',
		'self-hosted': 'Self-hosted',
		both: 'Hosted or self-hosted',
		unknown: 'Hosting not confirmed'
	};
	const access = {
		public: 'Public',
		internal: 'Argonne / internal',
		restricted: 'Restricted',
		unknown: 'Access not confirmed'
	};
</script>

<section class="mcp-panel" aria-labelledby="mcp-heading">
	<h2 id="mcp-heading">{mcp.deployment === 'self-hosted' ? 'Deploy MCP' : 'Connect to MCP'}</h2>
	<p><strong>{deployments[mcp.deployment]}</strong><br />{access[mcp.access]}</p>
	{#if mcp.transport !== 'unknown'}<p>
			Transport: {mcp.transport === 'http' ? 'Streamable HTTP' : mcp.transport}
		</p>{/if}
	{#if mcp.endpoint}<CodeBlock code={mcp.endpoint} label="MCP endpoint" />{/if}
	{#if mcp.authentication}<p><strong>Authentication</strong><br />{mcp.authentication}</p>{/if}
	<p class="instructions">{mcp.instructions}</p>
	{#if mcp.configuration}<CodeBlock code={mcp.configuration} label="Client configuration" />{/if}
	{#if mcp.tools}<details>
			<summary>Tools and capabilities</summary>
			<p class="instructions">{mcp.tools}</p>
		</details>{/if}
	<div class="links">
		{#if mcp.repository}<a href={mcp.repository} target="_blank" rel="noreferrer">Repository ↗</a
			>{/if}
		{#if mcp.documentation}<a href={mcp.documentation} target="_blank" rel="noreferrer"
				>Documentation ↗</a
			>{/if}
		<SaveButton {id} />
	</div>
</section>

<style>
	.mcp-panel {
		border: 1px solid var(--line);
		border-top: 3px solid var(--blue);
		border-radius: var(--radius);
		padding: 22px;
		min-width: 0;
	}
	h2 {
		font-size: 20px;
	}
	p,
	details {
		font-size: 13px;
		overflow-wrap: anywhere;
		margin-block: 14px;
	}
	.instructions {
		white-space: pre-wrap;
	}
	.links {
		display: flex;
		flex-wrap: wrap;
		gap: 14px;
		align-items: center;
		margin-top: 20px;
		font-size: 12px;
	}
</style>
