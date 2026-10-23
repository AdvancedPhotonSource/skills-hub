<script lang="ts">
	import { onMount } from 'svelte';
	import { base } from '$app/paths';
	import { Bookmark } from '@lucide/svelte';
	import { savedIds, toggleSaved } from '$lib/preferences';
	import SkillList from '$lib/components/SkillList.svelte';
	import type { Skill } from '$lib/types';
	let skills = $state<Skill[]>([]);
	let unavailable = $state(0);
	let loading = $state(true);
	let failed = $state(false);
	onMount(async () => {
		const ids = savedIds();
		const results = await Promise.allSettled(
			ids.map(async (id) => {
				const response = await fetch(`${base}/api/v1/skills/${encodeURIComponent(id)}`);
				if (response.status === 404) {
					unavailable += 1;
					return null;
				}
				if (!response.ok) throw new Error();
				return (await response.json()).skill as Skill;
			})
		);
		skills = results.flatMap((r) => (r.status === 'fulfilled' && r.value ? [r.value] : []));
		failed = results.some((r) => r.status === 'rejected');
		loading = false;
	});
	function remove(id: string) {
		try {
			toggleSaved(id);
			skills = skills.filter((s) => s.id !== id);
		} catch {
			failed = true;
		}
	}
</script>

<svelte:head><title>Saved skills · APS Skills Hub</title></svelte:head>
<div class="shell">
	<div class="page-head">
		<div class="eyebrow"><Bookmark size={16} /> Your shortlist</div>
		<h1>Keep a useful skill close.</h1>
		<p>Saved in this browser, ready when you need them.</p>
	</div>
	{#if failed}<div class="notice error" role="alert">
			Some saved skills could not be loaded or updated. Please reload to try again.
		</div>{/if}{#if unavailable}<div class="notice">
			{unavailable} saved {unavailable === 1 ? 'skill is' : 'skills are'} no longer available.
		</div>{/if}{#if loading}<p class="muted" role="status">
			Loading saved skills…
		</p>{:else if skills.length}{#each skills as skill}<div class="saved-row">
				<SkillList skills={[skill]} /><button
					class="button small"
					onclick={() => remove(skill.id)}
					aria-label={`Remove ${skill.name} from saved`}>Remove</button
				>
			</div>{/each}{:else}<div class="empty">
			<Bookmark size={30} />
			<h2>Your next useful find belongs here</h2>
			<p>Open a skill and choose Save to keep it in this browser.</p>
			<a class="button" href={`${base}/`}>Explore skills</a>
		</div>{/if}
</div>

<style>
	.saved-row {
		display: grid;
		grid-template-columns: minmax(0, 1fr) auto;
		gap: 24px;
		align-items: center;
	}
	.saved-row + .saved-row :global(.skill-list) {
		border-top: 0;
	}
	@media (max-width: 600px) {
		.saved-row {
			gap: 10px;
		}
		.saved-row > .button {
			padding: 6px;
			font-size: 10px;
		}
	}
</style>
