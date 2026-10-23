<script lang="ts">
	import { enhance } from '$app/forms';
	import { base } from '$app/paths';
	import { Upload, FileText, ChevronRight, Check, Eye, GitBranch, RefreshCw } from '@lucide/svelte';
	import { categories, roles } from '$lib/taxonomy';
	import type { Skill, ImportSource } from '$lib/types';
	import { sourceUrl } from '$lib/source';
	type Repository = {
		url: string;
		ref: string;
		commit: string;
		directory: string;
		directories: string[];
	};
	let {
		skill,
		form
	}: {
		skill?: Skill;
		form?: {
			message?: string;
			success?: boolean;
			repository?: Repository;
			preview?: {
				name: string;
				description: string;
				files: { path: string; size: number }[];
				html: string;
				source?: ImportSource;
			};
		} | null;
	} = $props();
	let pending = $state(false);
	let chosenFile = $state('');
	let method = $state('upload');
	let repositoryInput = $state('');
	let refInput = $state('');
	let repository = $state<Repository | null>(null);
	let directory = $state('');
	$effect(() => {
		const discovered = form?.repository;
		if (discovered) {
			repository = discovered;
			repositoryInput = discovered.url;
			refInput = discovered.ref;
			directory = discovered.directory || discovered.directories[0] || '.';
		}
	});
</script>

<svelte:head
	><title>{skill ? `Manage ${skill.name}` : 'Upload a skill'} · APS Skills Hub</title></svelte:head
>
<div class="shell editor-shell">
	<div class="page-head">
		<div class="breadcrumbs">
			<a href={`${base}/`}>Explore</a><ChevronRight size={13} />{#if skill}<a
					href={`${base}/skills/${skill.id}`}>{skill.name}</a
				><ChevronRight size={13} />{/if}<span>{skill ? 'Manage skill' : 'Upload skill'}</span>
		</div>
		<h1>{skill ? 'Keep your skill up to date.' : 'Share a useful starting point.'}</h1>
		<p>
			{skill
				? 'Publish a new revision or update how people find your skill. Previous revisions stay available.'
				: 'Upload your instructions, add a little context, and help someone take the next step.'}
		</p>
	</div>
	<div class="editor-layout">
		<div>
			{#if form?.message}<div class="notice" class:error={!form.success} role="status">
					{form.message}
				</div>{/if}
			{#if skill?.source}<section class="editor-section source-editor">
					<h2>Imported from GitHub</h2>
					<p>
						<a href={sourceUrl(skill.source)} target="_blank" rel="noreferrer"
							>{skill.source.repository} / {skill.source.directory || '(root)'}</a
						>
					</p>
					<p class="muted small-text">
						Tracks {skill.source.ref}. Current commit:
						<code>{skill.source.commit.slice(0, 12)}</code>. Refreshing creates a new revision when
						the source changes.
					</p>
					<form
						method="POST"
						action="?/refresh"
						use:enhance={() => {
							pending = true;
							return async ({ update }) => {
								await update();
								pending = false;
							};
						}}
					>
						<input type="hidden" name="expected" value={skill.revision} /><button
							class="button"
							disabled={pending}
							><RefreshCw size={15} />{pending ? 'Checking GitHub…' : 'Refresh from GitHub'}</button
						>
					</form>
				</section>{/if}
			<form
				method="POST"
				action="?/publish"
				enctype="multipart/form-data"
				use:enhance={() => {
					pending = true;
					return async ({ update }) => {
						await update({ reset: false });
						pending = false;
					};
				}}
			>
				{#if skill}<input type="hidden" name="expected" value={skill.revision} />{/if}
				<section class="editor-section">
					<div class="step-title">
						<span>1</span>
						<h2>{skill ? 'Skill files' : 'Choose your files'}</h2>
					</div>
					{#if !skill}<fieldset class="import-method">
							<legend class="sr-only">Skill source</legend><label
								><input type="radio" name="method" value="upload" bind:group={method} /> Upload files</label
							><label
								><input type="radio" name="method" value="github" bind:group={method} /> Import from GitHub</label
							>
						</fieldset>{/if}
					{#if method === 'github'}
						<div class="field">
							<label for="repository">GitHub repository or skill URL</label><input
								id="repository"
								name="repository"
								type="url"
								bind:value={repositoryInput}
								oninput={() => (repository = null)}
								placeholder="https://github.com/anthropics/skills"
								required
							/><small
								>Public repositories. Skill folders and their companion files are imported together.</small
							>
						</div>
						<div class="field">
							<label for="ref">Branch, tag, or commit <span class="muted">(optional)</span></label
							><input
								id="ref"
								name="ref"
								bind:value={refInput}
								oninput={() => (repository = null)}
								placeholder="Repository default branch"
								maxlength="200"
							/><small
								>For branch names containing a slash, use the repository URL and enter the branch
								here.</small
							>
						</div>
						<button class="button" formaction="?/discover" formnovalidate disabled={pending}
							><GitBranch size={16} />{pending ? 'Reading repository…' : 'Find skills'}</button
						>
						{#if repository}<div class="field directory-picker">
								<label for="directory">Skill directory</label><select
									id="directory"
									name="directory"
									bind:value={directory}
									>{#each repository.directories as path}<option value={path || '.'}
											>{path || '(repository root)'}</option
										>{/each}</select
								><input type="hidden" name="commit" value={repository.commit} /><small
									>Pinned to commit {repository.commit.slice(0, 12)}. Upstream files and license
									notices are preserved.</small
								>
							</div>{/if}
					{:else if !skill?.source}<div class="upload-zone">
							<Upload size={26} strokeWidth={1.5} /><label for="file"
								>{chosenFile ||
									(skill ? 'Upload a replacement package' : 'Choose a SKILL.md or ZIP file')}</label
							>
							<p>
								{skill
									? 'Optional. Leave blank to keep the current files.'
									: 'A single instruction file, or a skill folder with supporting files.'}
							</p>
							<input
								id="file"
								name="file"
								type="file"
								accept=".md,.zip"
								required={!skill}
								onchange={(e) => {
									chosenFile = e.currentTarget.files?.[0]?.name || '';
								}}
							/><small>10 MB upload · 200 files · 25 MB expanded</small>
						</div>{:else}<p class="small-text muted">
							The current imported files will be kept when you update the catalog information below.
						</p>{/if}
					{#if !skill?.source}<button
							class="button small preview-button"
							formaction="?/preview"
							formnovalidate
							disabled={pending || (method === 'github' ? !repository : !chosenFile)}
							><Eye size={15} />{pending ? 'Working…' : 'Preview package'}</button
						>{:else}<a class="button small" href={`${base}/skills/${skill.id}`}
							>Browse current files</a
						>{/if}
					{#if form?.preview && Boolean(form.preview.source) === (method === 'github')}<div
							class="package-preview"
						>
							<div class="preview-heading">
								<Check size={16} /><strong>{form.preview.name}</strong><span
									>{form.preview.files.length} files</span
								>
							</div>
							<p>{form.preview.description}</p>
							{#if form.preview.source}<p>
									<a href={sourceUrl(form.preview.source)} target="_blank" rel="noreferrer"
										>{form.preview.source.repository}</a
									>
									· {form.preview.source.commit.slice(0, 12)}
								</p>{/if}
							<details>
								<summary>Review instructions and files</summary>
								<div class="prose">{@html form.preview.html}</div>
								<ul>
									{#each form.preview.files as file}<li>
											<FileText size={13} />{file.path}<span
												>{(file.size / 1024).toFixed(1)} KB</span
											>
										</li>{/each}
								</ul>
							</details>
						</div>{/if}
				</section>
				<section class="editor-section">
					<div class="step-title">
						<span>2</span>
						<h2>Help others find it</h2>
					</div>
					<fieldset class="field">
						<legend>Categories <span class="muted">Choose up to five</span></legend>
						<div class="category-picker">
							{#each categories.filter((c) => !c.parent) as domain}<details
									open={skill?.categories.some(
										(id) =>
											id === domain.id ||
											categories.some((c) => c.id === id && c.parent === domain.id)
									)}
								>
									<summary>{domain.name}</summary><label
										><input
											type="checkbox"
											name="category"
											value={domain.id}
											checked={skill?.categories.includes(domain.id)}
										/>
										General {domain.name.toLowerCase()}</label
									>{#each categories.filter((c) => c.parent === domain.id) as category}<label
											><input
												type="checkbox"
												name="category"
												value={category.id}
												checked={skill?.categories.includes(category.id)}
											/>{category.name}</label
										>{/each}
								</details>{/each}
						</div>
					</fieldset>
					<div class="field">
						<label for="tags">Technology tags <span class="muted">(optional)</span></label><input
							id="tags"
							name="tags"
							value={skill?.tags.join(', ') || ''}
							placeholder="python, hdf5, numpy"
							maxlength="400"
						/><small>Separate tags with commas. Up to 10 tags.</small>
					</div>
					<div class="field">
						<label for="role">Useful for <span class="muted">(optional)</span></label><select
							id="role"
							name="role"
							value={skill?.role || ''}
							><option value="">Any role</option>{#each roles as role}<option>{role}</option
								>{/each}</select
						>
					</div>
					<div class="field">
						<label for="example">Example task <span class="muted">(optional)</span></label><textarea
							id="example"
							name="example"
							rows="3"
							maxlength="1000"
							placeholder="A concrete task someone could try with this skill."
							value={skill?.example || ''}
						></textarea>
					</div>
				</section>
				<div class="form-actions">
					<button class="button primary" disabled={pending || (method === 'github' && !repository)}
						><Upload size={16} />{pending
							? 'Working…'
							: skill
								? 'Publish revision'
								: 'Publish skill'}</button
					><a class="button" href={skill ? `${base}/skills/${skill.id}` : `${base}/my-skills`}
						>Cancel</a
					>
				</div>
			</form>
			{#if skill}<section class="archive-panel">
					<h2>{skill.archived ? 'Restore this skill' : 'Archive this skill'}</h2>
					<p>
						{skill.archived
							? 'Make this skill visible in the library again.'
							: 'Remove it from public browsing and downloads. Your revisions remain in My skills.'}
					</p>
					<form method="POST" action="?/archive" use:enhance>
						<input type="hidden" name="expected" value={skill.revision} /><input
							type="hidden"
							name="archived"
							value={skill.archived ? '0' : '1'}
						/><button class="button small" class:danger={!skill.archived}
							>{skill.archived ? 'Restore skill' : 'Archive skill'}</button
						>
					</form>
				</section>{/if}
		</div>
		<aside class="publishing-note">
			<FileText size={23} strokeWidth={1.4} />
			<h3>A portable skill folder</h3>
			<p>
				Your <code>SKILL.md</code> provides the name, description, and instructions. Supporting scripts,
				references, and assets stay together.
			</p>
			<pre>my-skill/
  SKILL.md
  references/
  scripts/
  assets/</pre>
			<h3>Yours to maintain</h3>
			<p>Anyone at Argonne can browse and download. Your account controls updates to this entry.</p>
			<a href="https://agentskills.io/specification" target="_blank" rel="noreferrer"
				>Agent Skills format ↗</a
			>
		</aside>
	</div>
</div>

<style>
	.editor-shell {
		max-width: 1060px;
	}
	.import-method {
		display: flex;
		gap: 24px;
		margin-bottom: 22px;
		font-size: 13px;
	}
	.import-method label {
		display: flex;
		align-items: center;
		gap: 6px;
	}
	.import-method input {
		accent-color: var(--blue);
	}
	.directory-picker {
		margin-top: 20px;
	}
	.source-editor {
		padding: 20px;
		border: 1px solid var(--line);
		border-radius: 8px;
		background: var(--surface);
		overflow-wrap: anywhere;
	}
	.source-editor h2 {
		font-size: 17px;
	}
	.editor-layout {
		display: grid;
		grid-template-columns: minmax(0, 1fr) 240px;
		gap: 64px;
	}
	.editor-section {
		margin-bottom: 30px;
	}
	.step-title {
		display: flex;
		align-items: center;
		gap: 11px;
		margin-bottom: 20px;
	}
	.step-title > span {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 25px;
		height: 25px;
		background: #eaf1fb;
		color: var(--blue);
		border-radius: 50%;
		font-size: 11px;
		font-weight: 650;
	}
	.step-title h2 {
		font-size: 17px;
		margin: 0;
	}
	.upload-zone {
		border: 1px dashed #b9cbe4;
		border-radius: 8px;
		background: #f8faff;
		padding: 26px;
		display: flex;
		flex-direction: column;
		align-items: center;
		text-align: center;
		color: #7091ba;
		gap: 8px;
	}
	.upload-zone > label {
		color: #3d5779;
		font-weight: 600;
		font-size: 14px;
	}
	.upload-zone > p {
		color: var(--muted);
		font-size: 12px;
		margin: 0;
	}
	.upload-zone input {
		color: var(--muted);
		font-size: 12px;
		background: white;
		max-width: 100%;
		margin: 8px 0;
	}
	.upload-zone small {
		font-size: 11px;
		color: var(--muted);
	}
	.preview-button {
		margin-top: 12px;
	}
	.category-picker {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 10px;
	}
	.category-picker details {
		border: 1px solid var(--line);
		border-radius: 6px;
		padding: 10px 12px;
		font-size: 12px;
	}
	.category-picker summary {
		cursor: pointer;
		font-weight: 550;
		color: #5d7089;
	}
	.category-picker label {
		display: flex;
		align-items: flex-start;
		gap: 7px;
		margin-top: 10px;
		font-size: 11px;
		color: var(--muted);
	}
	.category-picker input {
		width: 14px;
		height: 14px;
		flex-shrink: 0;
		margin-top: 3px;
	}
	.field legend > span {
		font-size: 11px;
		font-weight: 400;
		margin-left: 5px;
	}
	.publishing-note {
		border-left: 1px solid var(--line);
		padding-left: 26px;
		color: var(--muted);
		margin-top: 4px;
	}
	.publishing-note h3 {
		font-size: 13px;
		color: #566e8d;
		margin: 14px 0 9px;
	}
	.publishing-note p {
		font-size: 12px;
		line-height: 1.8;
	}
	.publishing-note pre {
		background: var(--surface);
		padding: 16px;
		font-size: 11px;
		border-radius: 6px;
		line-height: 1.9;
		margin: 20px 0 28px;
		color: var(--muted);
	}
	.publishing-note code {
		font-size: 11px;
	}
	.publishing-note a {
		font-size: 12px;
	}
	.package-preview {
		margin-top: 20px;
		border: 1px solid #cddfce;
		background: #f8fcf8;
		border-radius: 7px;
		padding: 18px;
	}
	.preview-heading {
		display: flex;
		align-items: center;
		gap: 8px;
		font-size: 13px;
		color: #3a714b;
	}
	.preview-heading > span {
		margin-left: auto;
		color: #728579;
		font-size: 11px;
	}
	.package-preview > p {
		font-size: 12px;
		margin: 10px 0;
		color: #677c6d;
	}
	.package-preview summary {
		font-size: 12px;
		color: #497454;
		cursor: pointer;
	}
	.package-preview .prose {
		margin-top: 20px;
	}
	.package-preview ul {
		padding: 10px 0 0;
		list-style: none;
		border-top: 1px solid #dce8dd;
	}
	.package-preview li {
		display: flex;
		align-items: center;
		gap: 7px;
		font-size: 11px;
		padding: 4px 0;
		overflow-wrap: anywhere;
	}
	.package-preview li > span {
		margin-left: auto;
		white-space: nowrap;
	}
	.archive-panel {
		border-top: 1px solid var(--line);
		margin-top: 40px;
		padding-top: 24px;
	}
	.archive-panel h2 {
		font-size: 16px;
	}
	.archive-panel p {
		font-size: 12px;
		color: var(--muted);
	}
	@media (max-width: 850px) {
		.editor-layout {
			grid-template-columns: 1fr;
			gap: 35px;
		}
		.publishing-note {
			display: none;
		}
	}
	@media (max-width: 500px) {
		.category-picker {
			grid-template-columns: 1fr;
		}
	}
</style>
