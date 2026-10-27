<script lang="ts">
	import { base } from '$app/paths';
	import { page } from '$app/state';
	import CodeBlock from './CodeBlock.svelte';
	let task = $state('');
	const hub = $derived(`${page.url.origin}${base}`);
	const prompt = $derived(
		`Read ${hub}/discovery/SKILL.md and use its workflow to search ${hub} for skills or MCPs relevant to this task:\n\n${task.trim() || '[Describe my use case]'}\n\nRecommend the best matches with links, requirements, and any gaps. Search only; do not install or run anything.`
	);
</script>

<details class="discovery">
	<summary>Find with your agent</summary>
	<div class="panel">
		<label for="discovery-task">What do you want to do?</label>
		<textarea
			id="discovery-task"
			bind:value={task}
			rows="2"
			maxlength="2000"
			placeholder="Find tools to reconstruct ptychography data and visualize the results."
		></textarea>
		<p>Copy this prompt to your agent. It searches the live hub and compares matches.</p>
		<CodeBlock code={prompt} label="Discovery prompt" />
		<a href={`${base}/discovery/skill.zip`}>Download discovery skill</a>
	</div>
</details>

<style>
	.discovery {
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
		background: white;
		border: 1px solid var(--line);
		border-radius: var(--radius);
	}
	label {
		display: block;
		font-weight: 600;
		margin-bottom: 7px;
	}
	textarea {
		width: 100%;
	}
	p {
		color: var(--muted);
		margin-block: 10px;
		font-size: 12px;
	}
	.panel > a {
		display: inline-block;
		margin-top: 12px;
	}
</style>
