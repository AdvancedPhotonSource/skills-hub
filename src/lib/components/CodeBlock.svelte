<script lang="ts">
	import { Check, Copy } from '@lucide/svelte';
	let { code, label }: { code: string; label: string } = $props();
	let copied = $state('');
	let error = $state('');
	async function copy() {
		const value = code;
		try {
			await navigator.clipboard.writeText(value);
			copied = value;
			error = '';
		} catch {
			error = 'Clipboard unavailable. Select and copy the code below.';
		}
	}
</script>

<div class="code-block">
	<div class="code-heading">
		<span>{label}</span><button onclick={copy} aria-label={`Copy ${label}`}>
			{#if copied === code}<Check size={14} />Copied{:else}<Copy size={14} />Copy{/if}
		</button>
	</div>
	<!-- svelte-ignore a11y_no_noninteractive_tabindex (Scrollable code needs keyboard focus.) -->
	<pre tabindex="0" role="region" aria-label={label}><code>{code}</code></pre>
	{#if error}<p role="status">{error}</p>{:else if copied === code}<span
			class="sr-only"
			role="status">Copied to clipboard</span
		>{/if}
</div>

<style>
	.code-block {
		border: 1px solid #263c56;
		border-radius: 10px;
		overflow: hidden;
		background: #17283d;
		color: #deebf6;
		min-width: 0;
	}
	.code-heading {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 15px;
		padding: 10px 15px;
		border-bottom: 1px solid #33475f;
		color: #b9ccdf;
		font:
			11px ui-monospace,
			monospace;
	}
	button {
		display: inline-flex;
		gap: 6px;
		align-items: center;
		color: #deebf6;
		border: 1px solid #51637b;
		background: #263c56;
		padding: 4px 9px;
		font-size: 11px;
	}
	pre {
		margin: 0;
		padding: 18px;
		overflow: auto;
		max-height: 440px;
		font:
			12px/1.8 ui-monospace,
			monospace;
		tab-size: 2;
	}
	p {
		padding: 0 18px;
		font-size: 12px;
		color: #deebf6;
	}
</style>
