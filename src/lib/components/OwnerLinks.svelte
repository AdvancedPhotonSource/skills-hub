<script lang="ts">
	import { base } from '$app/paths';
	import type { Owner } from '$lib/types';
	let { owners, showLabel = true }: { owners: Owner[]; showLabel?: boolean } = $props();
</script>

<span class="owners"
	>{showLabel ? 'Owner ' : ''}{#each owners as owner, index}{#if index > 0}{', '}{/if}<a
			href={`${base}/?author=${encodeURIComponent(owner.username)}`}
			>{owner.displayName.replace(/^([^,]+),\s*(.+)$/, '$2 $1')}</a
		>{/each}</span
>

<style>
	a {
		text-decoration: underline;
		text-underline-offset: 2px;
	}
</style>
