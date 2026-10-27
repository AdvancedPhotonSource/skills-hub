<script lang="ts">
	import type { Skill } from '$lib/types';
	let { skill }: { skill?: Skill } = $props();
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
	};
</script>

<div class="field">
	<label for="entry-name">Name</label><input
		id="entry-name"
		name="name"
		value={skill?.name || ''}
		required
		maxlength="64"
		placeholder="beamline-analysis-mcp"
	/>
</div>
<div class="field">
	<label for="description">Description</label><textarea
		id="description"
		name="description"
		required
		maxlength="1024"
		rows="2"
		value={skill?.description || ''}
	></textarea>
</div>
{#each [['mcpRepository', 'Repository', 'repository'], ['mcpDocumentation', 'Documentation', 'documentation'], ['endpoint', 'Hosted endpoint (if available)', 'endpoint']] as [name, label, key]}
	<div class="field">
		<label for={name}>{label}</label><input
			id={name}
			{name}
			type="url"
			value={skill?.mcp?.[key as 'repository' | 'documentation' | 'endpoint'] || ''}
			placeholder="https://…"
		/>
	</div>
{/each}
{#each ['deployment', 'access', 'transport'] as key}
	<div class="field">
		<label for={key}>{key[0].toUpperCase() + key.slice(1)}</label><select
			id={key}
			name={key}
			value={skill?.mcp?.[key as keyof typeof choices] || 'unknown'}
		>
			{#each choices[key as keyof typeof choices] as [value, label]}<option {value}>{label}</option
				>{/each}
		</select>
	</div>
{/each}
<div class="field">
	<label for="authentication">Authentication requirements</label><input
		id="authentication"
		name="authentication"
		value={skill?.mcp?.authentication || ''}
		maxlength="1000"
		placeholder="Describe requirements; do not include credentials"
	/>
</div>
{#each [['instructions', 'Connection / deployment instructions', 12000], ['configuration', 'Client configuration example', 8000], ['tools', 'Tools and capabilities', 4000]] as [key, label, max]}
	<div class="field">
		<label for={String(key)}>{label}</label><textarea
			id={String(key)}
			name={String(key)}
			rows="4"
			maxlength={Number(max)}
			required={key === 'instructions'}
			value={skill?.mcp?.[key as 'instructions' | 'configuration' | 'tools'] || ''}
		></textarea>
	</div>
{/each}
<div class="field">
	<label for="license">License</label><input
		id="license"
		name="license"
		value={skill?.license || ''}
		maxlength="500"
	/>
</div>
