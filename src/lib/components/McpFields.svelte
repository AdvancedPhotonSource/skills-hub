<script lang="ts">
	import { untrack } from 'svelte';
	import { mcpTemplates } from '$lib/mcp-templates';
	import type { Mcp, Skill } from '$lib/types';
	let { skill }: { skill?: Skill } = $props();
	let values = $state<Mcp & { name: string; description: string; license: string }>(
		untrack(() => {
			const initial = {
				name: skill?.name || '',
				description: skill?.description || '',
				license: skill?.license || '',
				repository: skill?.mcp?.repository || '',
				documentation: skill?.mcp?.documentation || '',
				endpoint: skill?.mcp?.endpoint || '',
				deployment: skill?.mcp?.deployment || ('unknown' as const),
				access: skill?.mcp?.access || ('unknown' as const),
				transport: skill?.mcp?.transport || ('unknown' as const),
				authentication: skill?.mcp?.authentication || '',
				instructions: skill?.mcp?.instructions || '',
				configuration: skill?.mcp?.configuration || '',
				tools: skill?.mcp?.tools || ''
			};
			return skill ? initial : { ...initial, ...mcpTemplates(initial) };
		})
	);
	let previousTemplates = untrack(() => mcpTemplates(values));
	let previousTransport = untrack(() => values.transport);
	$effect(() => {
		const templates = mcpTemplates(values);
		const transport = values.transport;
		untrack(() => {
			if (
				transport !== previousTransport ||
				(!skill && values.configuration === previousTemplates.configuration)
			)
				values.configuration = templates.configuration;
			if (!skill && values.instructions === previousTemplates.instructions)
				values.instructions = templates.instructions;
			previousTemplates = templates;
			previousTransport = transport;
		});
	});
	const choices = {
		deployment: [
			['unknown', 'Not confirmed'],
			['hosted', 'Existing hosted service'],
			['self-hosted', 'Self-hosted'],
			['both', 'Hosted or self-hosted']
		],
		access: [
			['unknown', 'Not confirmed'],
			['public', 'Public'],
			['internal', 'Argonne / internal'],
			['restricted', 'Restricted']
		],
		transport: [
			['unknown', 'Not confirmed'],
			['http', 'Streamable HTTP'],
			['stdio', 'stdio'],
			['sse', 'Legacy SSE']
		]
	} as const;
	const links = [
		['mcpRepository', 'Repository', 'repository'],
		['mcpDocumentation', 'Documentation', 'documentation'],
		['endpoint', 'Hosted endpoint (if available)', 'endpoint']
	] as const;
	const textFields = [
		['instructions', 'Connection / deployment instructions', 12000, 10],
		['configuration', 'Client configuration example', 8000, 9],
		['tools', 'Tools and capabilities', 4000, 7]
	] as const;
</script>

<div class="field">
	<label for="entry-name">Name</label><input
		id="entry-name"
		name="name"
		bind:value={values.name}
		required
		maxlength="64"
		placeholder="beamline-analysis-mcp"
	/>
</div>
<div class="field">
	<label for="description">Description</label>
	<textarea
		id="description"
		name="description"
		required
		maxlength="1024"
		rows="3"
		bind:value={values.description}
		placeholder="What does this MCP help users do, and with which data or systems?"
	></textarea>
</div>
{#each links as [name, label, key]}
	<div class="field">
		<label for={name}>{label}</label><input
			id={name}
			{name}
			type="url"
			bind:value={values[key]}
			placeholder={key === 'endpoint' ? 'https://your-server.example/mcp' : 'https://…'}
		/>
	</div>
{/each}
{#each ['deployment', 'access', 'transport'] as key (key)}
	{@const field = key as keyof typeof choices}
	<div class="field">
		<label for={key}>{key[0].toUpperCase() + key.slice(1)}</label><select
			id={key}
			name={key}
			bind:value={values[field]}
		>
			{#each choices[field] as [value, label]}<option {value}>{label}</option>{/each}
		</select>
	</div>
{/each}

<div class="field">
	<label for="authentication">Authentication requirements</label>
	<input
		id="authentication"
		name="authentication"
		bind:value={values.authentication}
		maxlength="1000"
		placeholder="Describe requirements; do not include credentials"
	/>
</div>
{#each textFields as [key, label, max, rows]}
	<div class="field">
		<label for={key}>{label}</label>
		<textarea
			id={key}
			name={key}
			{rows}
			maxlength={max}
			required={key === 'instructions'}
			bind:value={values[key]}
			aria-describedby={`${key}-hint`}
			class:configuration={key === 'configuration'}
			spellcheck={key !== 'configuration'}
		></textarea>
		<small id={`${key}-hint`}>
			{#if key === 'configuration'}
				{#if values.transport === 'unknown'}Choose a transport to fill its template.
				{/if}
				The example uses the mcpServers layout; adapt it to your MCP client's format and replace example
				paths, URLs, and settings. Changing transport replaces this example with the selected transport's
				template.
			{:else if key === 'instructions'}Include prerequisites, installation or access steps, how to
				connect, and how to verify it works. Markdown is supported.
			{:else}Describe each tool's inputs, outputs, and an example call. Add resources or prompts if
				supported.{/if}
		</small>
	</div>
{/each}
<div class="field">
	<label for="license">License</label><input
		id="license"
		name="license"
		bind:value={values.license}
		maxlength="500"
		placeholder="For example, MIT or Apache-2.0, if applicable"
	/>
</div>

<style>
	.configuration {
		font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
		font-size: 0.85rem;
	}
</style>
