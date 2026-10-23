<script lang="ts">
	import { Bookmark, BookmarkCheck } from '@lucide/svelte';
	import { savedIds, toggleSaved } from '$lib/preferences';
	let { id }: { id: string } = $props();
	let saved = $state(false);
	let message = $state('');
	$effect(() => {
		if (typeof localStorage !== 'undefined') saved = savedIds().includes(id);
	});
	function toggle() {
		try {
			saved = toggleSaved(id);
			message = '';
		} catch {
			message = 'Browser storage is unavailable.';
		}
	}
</script>

<button class="button" onclick={toggle} aria-pressed={saved}
	>{#if saved}<BookmarkCheck size={16} />Saved{:else}<Bookmark size={16} />Save{/if}</button
>{#if message}<span class="small-text" role="status">{message}</span>{/if}
