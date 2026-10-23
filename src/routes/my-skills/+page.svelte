<script lang="ts">
	import { base } from '$app/paths';
	import { Upload, FolderOpen } from '@lucide/svelte';
	import SkillList from '$lib/components/SkillList.svelte';
	let { data } = $props();
</script>

<svelte:head><title>My skills · APS Skills Hub</title></svelte:head>
<div class="shell">
	<div class="page-head section-heading">
		<div>
			<h1>My skills</h1>
			<p>Your contributions, ready to build on. Open a skill to manage its revisions.</p>
		</div>
		<a class="button primary" href={`${base}/upload`}><Upload size={16} />Upload skill</a>
	</div>
	{#if data.skills.length}<SkillList skills={data.skills} />{#if data.pages > 1}<div
				class="pagination"
			>
				{#if data.page > 1}<a href={`?page=${data.page - 1}`}>Previous</a>{/if}<span
					>Page {data.page} of {data.pages}</span
				>{#if data.page < data.pages}<a href={`?page=${data.page + 1}`}>Next</a>{/if}
			</div>{/if}{:else}<div class="empty">
			<FolderOpen size={32} />
			<h2>Share your first skill</h2>
			<p>
				Upload a SKILL.md file or a complete skill folder as a ZIP. You’ll be able to maintain it
				here.
			</p>
			<a class="button primary" href={`${base}/upload`}>Upload skill</a>
		</div>{/if}
</div>
