<script lang="ts">
	import { base } from '$app/paths';
	import { page } from '$app/state';
	import { Copy, Check, Download, Sparkles, Terminal, MessageSquare } from '@lucide/svelte';
	import SaveButton from './SaveButton.svelte';
	import RepositoryLink from './RepositoryLink.svelte';
	import { sourceUrl } from '$lib/source';
	import { installCommand, installPrompt, packageRunners, type PackageRunner } from '$lib/install';
	import type { Revision } from '$lib/types';
	let {
		id,
		revision,
		projectRepository
	}: { id: string; revision: Revision; projectRepository: string | null } = $props();
	let method = $state<'prompt' | 'command'>('prompt');
	let runner = $state<PackageRunner>('npx');
	let copiedText = $state('');
	let copyError = $state('');
	const hubUrl = $derived(new URL(`${base}/`, page.url).href.replace(/\/$/, ''));
	const downloadUrl = $derived(`${hubUrl}/skills/${id}/download?revision=${revision.number}`);
	const text = $derived(
		method === 'prompt'
			? installPrompt(`${hubUrl}/skill-install/prompt.md`, downloadUrl, revision.name)
			: installCommand(downloadUrl, revision.name, runner)
	);
	const githubUrl = $derived(revision.source ? sourceUrl(revision.source) : projectRepository);
	async function copy() {
		try {
			await navigator.clipboard.writeText(text);
			copiedText = text;
			copyError = '';
		} catch {
			copyError = 'Select and copy the text above; clipboard access is unavailable.';
		}
	}
</script>

<section class="install-panel" aria-labelledby="install-heading">
	<div class="install-heading">
		<span class="install-icon"><Sparkles size={19} /></span>
		<div>
			<h2 id="install-heading">Use this skill</h2>
			<p>Ready for your next task.</p>
		</div>
	</div>
	<div class="segmented" role="group" aria-label="Installation method">
		<button aria-pressed={method === 'prompt'} onclick={() => (method = 'prompt')}
			><MessageSquare size={14} />Prompt</button
		>
		<button aria-pressed={method === 'command'} onclick={() => (method = 'command')}
			><Terminal size={14} />Command</button
		>
	</div>
	<div class="install-content">
		<h3>{method === 'prompt' ? 'Install with an AI assistant' : 'Install from your terminal'}</h3>
		<p>
			{method === 'prompt'
				? 'Copy this prompt into the AI assistant you’re using.'
				: 'Run from your project directory to install this skill.'}
		</p>
		{#if method === 'command'}<div class="runners" role="group" aria-label="Package runner">
				{#each packageRunners as option}<button
						aria-pressed={runner === option}
						onclick={() => (runner = option)}>{option}</button
					>{/each}
			</div>{/if}
		<label class="sr-only" for="install-text"
			>{method === 'prompt' ? 'Installation prompt' : 'Installation command'}</label
		>
		<textarea
			id="install-text"
			class:command={method === 'command'}
			readonly
			value={text}
			rows={method === 'prompt' ? 7 : 6}
			spellcheck="false"
		></textarea>
		<button class="button primary copy-button" onclick={copy}
			>{#if copiedText === text}<Check size={16} />Copied{:else}<Copy size={15} />Copy {method}{/if}</button
		>
		{#if copyError}<p class="copy-status" role="status">
				{copyError}
			</p>{:else if copiedText === text}<span class="sr-only" role="status"
				>Copied to clipboard</span
			>{/if}
		<p class="install-note">
			{method === 'prompt'
				? 'Your assistant needs access to this hub. You can also download the ZIP and attach it.'
				: 'Requires Node.js 22.20+, your selected runner, and access to this hub and the npm registry.'}
		</p>
	</div>
	<div class="package-actions">
		<a class="button" href={downloadUrl}><Download size={15} />Download ZIP</a><SaveButton {id} />
	</div>
	{#if githubUrl}<RepositoryLink href={githubUrl} label={revision.source?.repository} embedded />
		{#if !revision.source}<p class="project-note">
				Project repository · skill maintained in this hub
			</p>{/if}{/if}
</section>

<style>
	.install-panel {
		min-width: 0;
		border: 1px solid #d7e2ef;
		border-radius: 14px;
		background: #fff;
		box-shadow: 0 8px 28px #20395508;
		padding: 22px;
		border-top: 3px solid var(--argonne-blue);
	}
	.install-heading {
		display: flex;
		align-items: center;
		gap: 12px;
		margin-bottom: 21px;
	}
	.install-icon {
		width: 40px;
		height: 40px;
		border-radius: 11px;
		display: grid;
		place-items: center;
		color: var(--blue);
		background: var(--blue-light);
	}
	h2 {
		font-size: 19px;
		margin: 0 0 3px;
	}
	.install-heading p {
		margin: 0;
		color: var(--muted);
		font-size: 12px;
	}
	.segmented {
		display: flex;
		padding: 4px;
		background: #f1f4f8;
		border: 1px solid var(--line);
		border-radius: 9px;
		gap: 4px;
	}
	.segmented button {
		flex: 1;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 7px;
		padding: 8px;
		border: 0;
		background: transparent;
		color: #53647c;
		font-size: 12px;
		font-weight: 600;
	}
	.segmented button[aria-pressed='true'] {
		background: #fff;
		color: var(--blue);
		box-shadow: 0 1px 4px #20395518;
	}
	.install-content {
		padding-top: 21px;
	}
	h3 {
		font-size: 13px;
		margin: 0 0 6px;
	}
	p {
		font-size: 12px;
		color: var(--muted);
		line-height: 1.7;
		margin-bottom: 13px;
	}
	textarea {
		width: 100%;
		padding: 13px;
		color: #315762;
		background: #f2f8f8;
		border-color: #d4e6e7;
		font-family: ui-monospace, monospace;
		font-size: 11px;
		line-height: 1.8;
		resize: vertical;
		min-height: 120px;
	}
	textarea.command {
		background: #17283d;
		color: #dcf1f7;
		border-color: #17283d;
	}
	.runners {
		display: flex;
		gap: 6px;
		margin: 13px 0 9px;
	}
	.runners button {
		font:
			11px ui-monospace,
			monospace;
		background: #fff;
		border: 1px solid #dbe2ea;
		color: #53647c;
		padding: 6px 12px;
	}
	.runners button[aria-pressed='true'] {
		background: #eaf4f2;
		color: #1d6658;
		border-color: #7fb7aa;
	}
	.copy-button {
		width: 100%;
		margin-top: 10px;
	}
	.install-note {
		font-size: 11px;
		margin: 11px 0 18px;
	}
	.package-actions {
		display: flex;
		gap: 8px;
		padding-top: 17px;
		border-top: 1px solid var(--line);
	}
	.package-actions :global(.button) {
		padding: 8px 12px;
		font-size: 12px;
		flex: 1;
	}
	.project-note {
		font-size: 10px;
		margin: 8px 0 0;
	}
	@media (max-width: 900px) {
		.install-panel {
			order: -1;
			width: 100%;
		}
	}
</style>
