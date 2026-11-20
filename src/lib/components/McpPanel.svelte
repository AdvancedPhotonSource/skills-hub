<script lang="ts">
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { onMount } from 'svelte';
	import CodeBlock from './CodeBlock.svelte';
	const hub = $derived(`${page.url.origin}${resolve('')}`.replace(/\/$/, ''));
	const endpoint = $derived(`${hub}/mcp`);
	const command = $derived(`claude mcp add --transport http aps-hub ${endpoint}`);
	const config = $derived(
		JSON.stringify({ mcpServers: { 'aps-hub': { type: 'http', url: endpoint } } }, null, 2)
	);
	let manual = $state(false);
	// The toggle only works once the handler is bound, so it stays disabled
	// until then rather than ignoring clicks.
	let ready = $state(false);
	onMount(() => (ready = true));
</script>

<details class="connect">
	<summary>Connect your agent</summary>
	<div class="panel">
		<p class="intro">
			Add the hub to your AI assistant once. It can then search the catalogue, read a skill's
			instructions, and install skills and MCPs for you, without you copying anything from this
			page.
		</p>
		<CodeBlock code={command} label="Add the hub to Claude Code" />
		<p class="note">
			The first time your agent connects, a browser window asks you to sign in with Argonne and
			approve it. Your assistant stores and renews its own access from then on — there is no key to
			copy or keep.
		</p>
		<button
			type="button"
			class="toggle"
			disabled={!ready}
			aria-expanded={manual}
			onclick={() => (manual = !manual)}
		>
			{manual ? 'Hide' : 'Show'} configuration for other assistants
		</button>
		{#if manual}
			<p class="note">
				Any assistant that supports remote MCP servers over HTTP can use the same endpoint.
			</p>
			<CodeBlock code={config} label="MCP server configuration" />
		{/if}
		<p class="note tools">
			Available tools: <code>search_skills</code>, <code>get_skill</code>,
			<code>read_skill_file</code> and <code>install_skill</code>. Read-only — an agent can never
			publish, edit or delete, and only sees what you could open yourself.
		</p>
	</div>
</details>

<style>
	.connect {
		margin-top: 16px;
		max-width: 635px;
		font-size: 13px;
	}
	summary {
		cursor: pointer;
		color: var(--blue);
		font-weight: 600;
	}
	.panel {
		margin-top: 12px;
		padding: 18px;
		background: var(--paper);
		border: 1px solid var(--line);
		border-radius: var(--radius);
	}
	.intro {
		margin: 0 0 14px;
	}
	.note {
		color: var(--muted);
		margin-block: 10px 0;
		font-size: 12px;
	}
	.tools code {
		font-size: 11px;
	}
	.toggle {
		margin-top: 12px;
		background: none;
		border: none;
		padding: 0;
		font: inherit;
		font-size: 12px;
		color: var(--blue);
		cursor: pointer;
		text-decoration: underline;
	}
	.toggle:disabled {
		color: var(--muted);
		cursor: default;
		text-decoration: none;
	}
</style>
