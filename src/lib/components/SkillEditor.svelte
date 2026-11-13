<script lang="ts">
	import { enhance } from '$app/forms';
	import { base } from '$app/paths';
	import { page } from '$app/state';
	import { Upload, FileText, ChevronRight, Check, Eye, GitBranch } from '@lucide/svelte';
	import { categories, roles, techniques } from '$lib/taxonomy';
	import { onMount, untrack } from 'svelte';
	import McpFields from './McpFields.svelte';
	import ContextPicker from './ContextPicker.svelte';
	import OwnerLinks from './OwnerLinks.svelte';
	import type { Skill, ImportSource, Owner } from '$lib/types';
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
		ownerChoices = [],
		memberChoices = [],
		form
	}: {
		skill?: Skill;
		ownerChoices?: Owner[];
		memberChoices?: Skill[];
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
	let ready = $state(false);
	onMount(() => {
		ready = true;
	});
	let chosenFile = $state('');
	let method = $state('upload');
	let applicationType = $state(untrack(() => skill?.applicationType || 'skill'));
	let provenance = $state(untrack(() => skill?.provenance || 'argonne'));
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
	><title>{skill ? `Manage ${skill.name}` : 'Publish'} · APS Skills Hub</title></svelte:head
>
<div class="shell editor-shell">
	<div class="page-head">
		<div class="breadcrumbs">
			<a href={`${base}/`}>Explore</a><ChevronRight size={13} />{#if skill}<a
					href={`${base}/skills/${skill.id}`}>{skill.name}</a
				><ChevronRight size={13} />{/if}<span>{skill ? 'Manage entry' : 'Publish'}</span>
		</div>
		<h1>{skill ? 'Keep your contribution up to date.' : 'Share a useful starting point.'}</h1>
		<p>
			{skill
				? 'Update the content and how people find it.'
				: 'Share a skill, MCP, or collection for an APS workflow.'}
		</p>
	</div>
	<div class="editor-layout">
		<fieldset disabled={!ready} aria-label="Entry editor">
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
				<div class="field">
					<label for="application-type">Application type</label><select
						id="application-type"
						name="applicationType"
						bind:value={applicationType}
						><option value="skill">Skill</option><option value="mcp">MCP</option><option
							value="collection">Collection</option
						></select
					>
				</div>
				{#if applicationType === 'collection'}
					<section class="editor-section">
						<div class="step-title">
							<span>1</span>
							<h2>Bring related entries together</h2>
						</div>
						<p class="small-text muted">
							Publish your skills or MCPs first, then select them here to ship together. Each entry
							keeps its own owners, source, and updates.
						</p>
						<div class="field">
							<label for="collection-title">Collection title</label><input
								id="collection-title"
								name="collectionTitle"
								value={skill?.collectionTitle || ''}
								placeholder="Ptychodus collection"
								maxlength="120"
								required
							/>
						</div>
						<div class="field">
							<label for="collection-name">Collection identifier</label><input
								id="collection-name"
								name="name"
								value={skill?.name || ''}
								placeholder="ptychodus-collection"
								pattern="[a-z0-9]+(-[a-z0-9]+)*"
								maxlength="64"
								readonly={Boolean(skill)}
								required
							/>
						</div>
						<div class="field">
							<label for="collection-description">Description</label><textarea
								id="collection-description"
								name="description"
								maxlength="1024"
								required>{skill?.description || ''}</textarea
							>
						</div>
						<div class="field">
							<label for="collection-repository"
								>Linked repository <span class="muted">(optional)</span></label
							><input
								id="collection-repository"
								name="sourceUrl"
								type="url"
								value={skill?.sourceUrl || ''}
								placeholder="https://github.com/organization/project"
							/>
						</div>
						<fieldset class="field">
							<legend>Included skills and MCPs <span class="muted">Choose 2–100</span></legend>
							<div class="collection-picker">
								{#each memberChoices as member}<label
										><input
											type="checkbox"
											name="collectionMember"
											value={member.id}
											checked={skill?.collectionMembers?.includes(member.id)}
										/><span
											><strong>{member.name}</strong><small
												>{member.applicationType === 'mcp' ? 'MCP' : 'Skill'} · {member.description}</small
											></span
										></label
									>{/each}
							</div>
							{#if memberChoices.length < 2}<p class="small-text muted">
									You need at least two published skills or MCPs that you own to create a
									collection.
								</p>{/if}
						</fieldset>
					</section>
				{:else if applicationType === 'mcp'}
					<section class="editor-section"><McpFields {skill} /></section>
				{:else}
					<section class="editor-section">
						<div class="step-title">
							<span>1</span>
							<h2>{skill ? 'Skill files' : 'Choose your files'}</h2>
						</div>
						{#if !skill}<fieldset class="import-method">
								<legend class="sr-only">Skill source</legend><label
									><input type="radio" name="method" value="upload" bind:group={method} /> Upload files</label
								><label
									><input
										type="radio"
										name="method"
										value="github"
										bind:group={method}
										onchange={() => (provenance = 'external')}
									/> Import from GitHub</label
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
									>Public repositories. Skill folders and their companion files are imported
									together.</small
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
										(skill
											? 'Upload a replacement package'
											: 'Choose a SKILL.md or ZIP file')}</label
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
								The current imported files will be kept when you update the catalog information
								below.
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
				{/if}
				<section class="editor-section">
					<div class="step-title">
						<span>2</span>
						<h2>Help others find it</h2>
					</div>
					<fieldset class="field">
						<legend>Workflow <span class="muted">Choose up to five</span></legend>
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
					<ContextPicker contexts={skill?.contexts} />
					<fieldset class="field">
						<legend>Scientific techniques</legend>
						<div class="category-picker">
							{#each techniques as [value, label]}<label
									><input
										type="checkbox"
										name="technique"
										{value}
										checked={skill?.techniques.includes(value)}
									/>
									{label}</label
								>{/each}
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
					<div class="field">
						<label for="provenance">Authorship</label><select
							id="provenance"
							name="provenance"
							bind:value={provenance}
							><option value="argonne">Argonne-authored</option><option value="external"
								>External</option
							><option value="adapted">Adapted from external work</option></select
						>
					</div>
					{#if provenance !== 'argonne'}
						<div class="field">
							<label for="upstream-author">Original author / organization</label><input
								id="upstream-author"
								name="upstreamAuthor"
								value={skill?.upstreamAuthor || skill?.source?.author || ''}
								required={method !== 'github'}
								maxlength="200"
							/><small>For GitHub imports, defaults to the repository owner.</small>
						</div>
						{#if applicationType !== 'collection'}<div class="field">
								<label for="source-url">Original source URL</label><input
									id="source-url"
									name="sourceUrl"
									type="url"
									value={skill?.sourceUrl || ''}
									required={method !== 'github'}
								/>
							</div>{/if}
						<div class="field">
							<label for="relevance">APS use case</label><textarea
								id="relevance"
								name="relevance"
								rows="2"
								value={skill?.relevance || ''}
								required
								maxlength="1000"
							></textarea>
						</div>
					{/if}
				</section>
				<div class="form-actions">
					<button
						class="button primary"
						disabled={pending ||
							(applicationType === 'skill' && method === 'github' && !repository)}
						><Upload size={16} />{pending
							? 'Working…'
							: skill
								? 'Save changes'
								: applicationType === 'mcp'
									? 'Publish MCP'
									: applicationType === 'collection'
										? 'Publish collection'
										: 'Publish skill'}</button
					><a class="button" href={skill ? `${base}/skills/${skill.id}` : `${base}/my-skills`}
						>Cancel</a
					>
				</div>
			</form>
			{#if skill}<section class="archive-panel">
					<h2>Delete this entry</h2>
					<p>Permanently removes the entry and all its stored files and history.</p>
					<form method="POST" action="?/delete" use:enhance>
						<input type="hidden" name="expected" value={skill.revision} /><button
							class="button small danger">Delete entry</button
						>
					</form>
				</section>{/if}
			{#if skill}
				<section class="panel">
					<h2>Owners</h2>
					<form method="POST" action="?/owners" use:enhance>
						<input
							type="hidden"
							name="expectedOwners"
							value={JSON.stringify(skill.owners.map((owner) => owner.id))}
						/>
						<fieldset class="owner-choices">
							<legend>Select owners</legend>
							{#each [...skill.owners, ...ownerChoices.filter((choice) => !skill.owners.some((owner) => owner.id === choice.id))] as owner}
								<label
									><input
										type="checkbox"
										name="owner"
										value={owner.id}
										checked={skill.owners.some((current) => current.id === owner.id)}
									/>
									{owner.displayName.replace(/^([^,]+),\s*(.+)$/, '$2 $1')} (@{owner.username})</label
								>
							{/each}
						</fieldset>
						<button class="button small">Save owners</button>
					</form>
				</section>
			{/if}
		</fieldset>
		<aside class="publishing-note">
			<FileText size={23} strokeWidth={1.4} />
			<h3>
				{applicationType === 'collection'
					? 'Better together'
					: applicationType === 'mcp'
						? 'A connection to tools'
						: 'A portable skill folder'}
			</h3>
			<p>
				{applicationType === 'collection'
					? 'Group related skills and MCPs in one place, with a shared overview and a single download.'
					: applicationType === 'mcp'
						? 'Describe how to connect or deploy. A public repository does not necessarily offer a public endpoint.'
						: 'Upload SKILL.md or a ZIP with its supporting files.'}
			</p>
			<p>
				{#if skill}<OwnerLinks owners={skill.owners} />{:else}Owner {page.data.user
						?.displayName}{/if}. All Argonne SSO users can publish skills and MCPs.
			</p>
		</aside>
	</div>
</div>

<style>
	.collection-picker {
		display: grid;
		max-height: 360px;
		overflow: auto;
		border: 1px solid var(--line);
		border-radius: var(--radius);
	}
	.collection-picker label {
		display: flex;
		align-items: flex-start;
		gap: 12px;
		padding: 14px;
		border-bottom: 1px solid var(--line);
	}
	.collection-picker input {
		width: auto;
		margin-top: 4px;
	}
	.collection-picker small {
		display: block;
		font-weight: 400;
		margin-top: 4px;
	}
	.owner-choices {
		display: grid;
		gap: 8px;
		max-height: 240px;
		overflow: auto;
		margin-bottom: 16px;
	}
	.owner-choices label {
		display: flex;
		align-items: center;
		gap: 8px;
	}
	.owner-choices input {
		width: auto;
	}
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
		background: var(--blue-light);
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
		border: 1px dashed var(--line);
		border-radius: 8px;
		background: var(--surface);
		padding: 26px;
		display: flex;
		flex-direction: column;
		align-items: center;
		text-align: center;
		color: #7091ba;
		gap: 8px;
	}
	.upload-zone > label {
		color: light-dark(#3d5779, var(--text));
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
		background: var(--paper);
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
		color: var(--muted);
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
		color: var(--muted);
		margin: 14px 0 9px;
	}
	.publishing-note p {
		font-size: 12px;
		line-height: 1.8;
	}
	.package-preview {
		margin-top: 20px;
		border: 1px solid light-dark(#cddfce, #365c4e);
		background: light-dark(#f8fcf8, #193c31);
		border-radius: 7px;
		padding: 18px;
	}
	.preview-heading {
		display: flex;
		align-items: center;
		gap: 8px;
		font-size: 13px;
		color: light-dark(#3a714b, var(--argonne-green));
	}
	.preview-heading > span {
		margin-left: auto;
		color: var(--muted);
		font-size: 11px;
	}
	.package-preview > p {
		font-size: 12px;
		margin: 10px 0;
		color: var(--muted);
	}
	.package-preview summary {
		font-size: 12px;
		color: light-dark(#497454, var(--argonne-green));
		cursor: pointer;
	}
	.package-preview .prose {
		margin-top: 20px;
	}
	.package-preview ul {
		padding: 10px 0 0;
		list-style: none;
		border-top: 1px solid light-dark(#dce8dd, #365c4e);
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
