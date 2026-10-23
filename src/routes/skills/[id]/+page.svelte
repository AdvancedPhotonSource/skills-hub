<script lang="ts">
	import { base } from '$app/paths';
	import {
		Download,
		FileText,
		ChevronRight,
		Clock,
		Pencil,
		ArrowRight,
		GitBranch,
		ExternalLink
	} from '@lucide/svelte';
	import { categoryName, categoryTone } from '$lib/taxonomy';
	import InstallCard from '$lib/components/InstallCard.svelte';
	import FileExplorer from '$lib/components/FileExplorer.svelte';
	import SkillList from '$lib/components/SkillList.svelte';
	import { sourceUrl, repositoryUrl } from '$lib/source';
	let { data } = $props();
	const fileUrl = (path: string, view = '') => {
		const q = new URLSearchParams({ revision: String(data.revision.number), file: path });
		if (view) q.set('view', view);
		return `?${q}`;
	};
</script>

<svelte:head
	><title>{data.revision.name} · APS Skills Hub</title><meta
		name="description"
		content={data.revision.description}
	/></svelte:head
>
<div class="shell detail-shell">
	<div class="page-head">
		<div class="breadcrumbs">
			<a href={`${base}/`}>Explore</a><ChevronRight size={13} /><a
				href={`${base}/?category=${data.skill.categories[0]}`}
				>{categoryName(data.skill.categories[0])}</a
			><ChevronRight size={13} /><span>{data.revision.name}</span>
		</div>
		{#if data.skill.archived}<div class="notice">
				This skill is archived. It is visible only to its owner and administrators.
			</div>{/if}{#if data.revision.number !== data.skill.revision}<div class="notice">
				You’re viewing revision {data.revision.number}.
				<a href={`${base}/skills/${data.skill.id}`}>View the current revision</a>
			</div>{/if}
		<div class="detail-heading">
			<div class="detail-icon tone" data-tone={categoryTone(data.skill.categories[0])}>
				<FileText size={28} strokeWidth={1.4} />
			</div>
			<div>
				<div class="name-line">
					<h1>{data.revision.name}</h1>
					<span class="badge">Revision {data.revision.number}</span>
					<span class="badge category-chip" data-tone={data.revision.source ? 'violet' : 'teal'}
						>{data.revision.source ? 'Repository import' : 'Local contribution'}</span
					>
				</div>
				<p>{data.revision.description}</p>
			</div>
		</div>
		<div class="attribution">
			<span class="avatar"
				>{(data.revision.source?.author || data.skill.displayName).slice(0, 1).toUpperCase()}</span
			><a
				href={data.revision.source
					? `${base}/?repository=${encodeURIComponent(data.revision.source.repository)}`
					: `${base}/?author=${encodeURIComponent(data.skill.username)}`}
				>{data.revision.source?.repository || data.skill.displayName}</a
			><span class="separator"></span><Clock size={13} /><time datetime={data.revision.createdAt}
				>{new Date(data.revision.createdAt).toLocaleDateString('en-US', {
					month: 'short',
					day: 'numeric',
					year: 'numeric',
					timeZone: 'UTC'
				})}</time
			><span class="separator"></span><Download size={13} /><span
				>{data.skill.downloads} downloads</span
			>
		</div>
		{#if data.revision.source}<div class="source-line">
				<a href={sourceUrl(data.revision.source)} target="_blank" rel="noreferrer"
					><GitBranch size={15} />View original skill <ExternalLink size={12} /></a
				><span
					>Imported from commit <a
						href={`${repositoryUrl(data.revision.source)}/commit/${data.revision.source.commit}`}
						target="_blank"
						rel="noreferrer"><code>{data.revision.source.commit.slice(0, 12)}</code></a
					></span
				>
			</div>{/if}
		{#if data.skill.example}<div class="example-task">
				<strong>Try this task</strong>
				<p>{data.skill.example}</p>
			</div>{/if}
	</div>
	<div class="detail-layout">
		<section class="source-section" aria-labelledby="source-heading">
			<div class="source-intro">
				<h2 id="source-heading">Review the source files</h2>
				<p>Read the instructions and companion files before adding this skill to your agent.</p>
			</div>
			<div class="file-panel">
				<FileExplorer files={data.revision.files} path={data.path} {fileUrl} />
				<div class="file-content">
					<div class="file-toolbar">
						<span>{data.path}</span>
						<div>
							{#if data.html}<a class:chosen={!data.raw} href={fileUrl(data.path)}>Preview</a><a
									class:chosen={data.raw}
									href={fileUrl(data.path, 'source')}>Source</a
								>{/if}<a
								aria-label="Download file"
								href={`${base}/skills/${data.skill.id}/file?revision=${data.revision.number}&path=${encodeURIComponent(data.path)}`}
								><Download size={14} /></a
							>
						</div>
					</div>
					<div class="file-body">
						{#if data.binary}<div class="empty">
								<FileText size={24} />
								<h2>Binary file</h2>
								<p>Download this file to view it in a compatible application.</p>
							</div>{:else if data.html && !data.raw}<div class="prose">
								{@html data.html}
							</div>{:else}
							<!-- svelte-ignore a11y_no_noninteractive_tabindex (Scrollable source needs keyboard focus.) -->
							<pre
								class="raw-source"
								tabindex="0"
								role="region"
								aria-label="File source">{data.text}</pre>{/if}{#if data.truncated}<div
								class="notice"
								style="margin-top: 20px"
							>
								Preview limited to the first 100 KB. Download the file to read it in full.
							</div>{/if}
					</div>
				</div>
			</div>
		</section>
		<aside class="detail-sidebar">
			<InstallCard
				id={data.skill.id}
				revision={data.revision}
				projectRepository={data.projectRepository}
			/>
			<section class="metadata">
				<h3>About this skill</h3>
				<dl>
					{#if data.revision.source}<dt>Source publisher</dt>
						<dd>{data.revision.source.author}</dd>
						<dt>Repository</dt>
						<dd>
							<a href={repositoryUrl(data.revision.source)} target="_blank" rel="noreferrer"
								>{data.revision.source.repository}</a
							>
						</dd>
						<dt>Source commit date</dt>
						<dd>
							{new Date(data.revision.source.commitDate).toLocaleDateString('en-US', {
								year: 'numeric',
								month: 'short',
								day: 'numeric',
								timeZone: 'UTC'
							})}
						</dd>
						<dt>Tracking ref</dt>
						<dd>{data.revision.source.ref}</dd>{/if}
					<dt>{data.revision.source ? 'Maintained on this hub by' : 'Published by'}</dt>
					<dd>
						<a href={`${base}/?author=${encodeURIComponent(data.skill.username)}`}
							>{data.skill.username}</a
						>
					</dd>
					<dt>Categories</dt>
					<dd class="tags">
						{#each data.skill.categories as category}<a
								class="badge category-chip"
								data-tone={categoryTone(category)}
								href={`${base}/?category=${category}`}>{categoryName(category)}</a
							>{/each}
					</dd>
					{#if data.skill.tags.length}<dt>Technologies</dt>
						<dd class="tags">
							{#each data.skill.tags as tag}<a
									class="badge"
									href={`${base}/?tag=${encodeURIComponent(tag)}`}>{tag}</a
								>{/each}
						</dd>{/if}{#if data.skill.role}<dt>Useful for</dt>
						<dd>{data.skill.role}</dd>{/if}
					<dt>{data.revision.source ? 'Upstream license declaration' : 'License'}</dt>
					<dd>{data.revision.license || 'Not specified'}</dd>
					{#if data.revision.source?.licenses.length}<dt>Included license notices</dt>
						<dd class="license-links">
							{#each data.revision.source.licenses as license}<a href={fileUrl(license.path)}
									>{license.path}</a
								>{/each}
						</dd>{/if}
					{#if data.revision.compatibility}<dt>Requirements</dt>
						<dd>{data.revision.compatibility}</dd>{/if}
					<dt>Package checksum</dt>
					<dd class="checksum" title={data.revision.checksum}>
						SHA-256<br />{data.revision.checksum}
					</dd>
				</dl>
			</section>
			<details class="history">
				<summary>Revision history <span>{data.history.length}</span></summary
				>{#each data.history as revision}<a
						href={`?revision=${revision.number}`}
						class:chosen={revision.number === data.revision.number}
						><span
							>Revision {revision.number}{revision.version ? ` · ${revision.version}` : ''}</span
						><time
							>{new Date(revision.createdAt).toLocaleDateString('en-US', {
								month: 'short',
								day: 'numeric',
								timeZone: 'UTC'
							})}</time
						></a
					>{/each}
			</details>
			{#if data.canEdit}<a class="button manage" href={`${base}/skills/${data.skill.id}/edit`}
					><Pencil size={14} />Manage skill</a
				>{/if}
		</aside>
	</div>
	{#if data.related.length}<section class="related">
			<div class="section-heading">
				<h2>Keep exploring</h2>
				<a href={`${base}/?category=${data.skill.categories[0]}`} class="small-text"
					>More in this category <ArrowRight size={13} /></a
				>
			</div>
			<SkillList skills={data.related} />
		</section>{/if}
</div>

<style>
	.detail-shell {
		max-width: 1240px;
	}
	.source-line {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 20px;
		margin-top: 18px;
		font-size: 12px;
		color: var(--muted);
	}
	.source-line > a {
		display: inline-flex;
		align-items: center;
		gap: 6px;
	}
	.source-line code {
		font-size: 11px;
	}
	.example-task {
		margin-top: 23px;
		border: 1px solid #d7e8e4;
		border-left: 3px solid #4b9584;
		background: #f4faf8;
		border-radius: 0 9px 9px 0;
		padding: 13px 18px;
		max-width: 800px;
	}
	.example-task strong {
		font-size: 12px;
		color: #276457;
	}
	.example-task p {
		font-size: 13px;
		margin: 5px 0 0;
	}
	.license-links {
		display: flex;
		flex-direction: column;
		gap: 5px;
	}
	.detail-heading {
		display: flex;
		gap: 20px;
	}
	.detail-icon {
		width: 60px;
		height: 66px;
		display: flex;
		justify-content: center;
		align-items: center;
		background: var(--tone-bg);
		border: 1px solid var(--tone-line);
		color: var(--tone);
		border-radius: 10px;
		flex-shrink: 0;
	}
	.name-line {
		display: flex;
		align-items: center;
		gap: 15px;
		flex-wrap: wrap;
		margin-bottom: 12px;
	}
	.name-line h1 {
		font-size: 32px;
		margin: 0;
		overflow-wrap: anywhere;
	}
	.detail-heading p {
		max-width: 800px;
		font-size: 14px;
		line-height: 1.8;
	}
	.attribution {
		display: flex;
		align-items: center;
		gap: 9px;
		color: var(--muted);
		font-size: 11px;
		flex-wrap: wrap;
		margin: 23px 0 6px;
	}
	.attribution > a {
		color: #5d7392;
	}
	.attribution .avatar {
		width: 23px;
		height: 23px;
		font-size: 10px;
	}
	.separator {
		height: 12px;
		width: 1px;
		background: var(--line);
		margin-inline: 7px;
	}
	.detail-layout {
		display: grid;
		grid-template-columns: minmax(0, 1fr) 340px;
		gap: 30px;
		align-items: start;
	}
	.file-panel {
		border: 1px solid var(--line);
		border-radius: 12px;
		overflow: hidden;
	}
	.source-section {
		min-width: 0;
	}
	.source-intro {
		margin: 0 0 19px;
	}
	.source-intro h2 {
		font-size: 21px;
		margin-bottom: 7px;
	}
	.source-intro p {
		color: var(--muted);
		font-size: 12px;
		margin: 0;
	}
	.file-content {
		min-width: 0;
	}
	.file-toolbar {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 10px;
		padding: 13px 20px;
		border-bottom: 1px solid var(--line);
		font-size: 11px;
		color: var(--muted);
	}
	.file-toolbar > span {
		overflow-wrap: anywhere;
	}
	.file-toolbar > div {
		display: flex;
		align-items: center;
		gap: 12px;
	}
	.file-toolbar a {
		color: var(--muted);
	}
	.file-toolbar a.chosen {
		color: #175ac6;
		background: #eaf1fd;
		border-radius: 4px;
	}
	.file-toolbar a {
		padding: 4px 7px;
	}
	.file-body {
		padding: 27px;
	}
	.metadata {
		padding: 25px 4px 10px;
	}
	.metadata h3 {
		font-size: 13px;
	}
	.metadata dt {
		font-size: 10px;
		color: var(--muted);
		margin: 18px 0 5px;
	}
	.metadata dd {
		margin: 0;
		font-size: 12px;
		color: var(--muted);
		overflow-wrap: anywhere;
	}
	.metadata dd.checksum {
		font-family: ui-monospace, monospace;
		font-size: 9px;
		line-height: 1.8;
		color: var(--muted);
	}
	.history {
		margin-top: 14px;
		padding: 18px 4px;
		border-top: 1px solid var(--line);
		border-bottom: 1px solid var(--line);
		font-size: 12px;
		color: var(--muted);
	}
	.history summary {
		cursor: pointer;
	}
	.history summary > span {
		float: right;
		color: var(--muted);
	}
	.history > a {
		display: flex;
		justify-content: space-between;
		margin-top: 12px;
		font-size: 11px;
		color: var(--muted);
	}
	.history > a.chosen {
		color: var(--blue);
	}
	.manage {
		margin-top: 18px;
		width: 100%;
		font-size: 12px;
	}
	.related {
		margin-top: 44px;
		max-width: 850px;
	}
	.related h2 {
		font-size: 19px;
	}
	.related .section-heading > a {
		display: flex;
		align-items: center;
		gap: 7px;
	}
	@media (max-width: 1000px) {
		.detail-layout {
			grid-template-columns: minmax(0, 1fr) 310px;
			gap: 20px;
		}
		.file-body {
			padding: 22px;
		}
	}
	@media (max-width: 900px) {
		.detail-layout {
			display: flex;
			flex-direction: column;
		}
		.detail-sidebar {
			display: contents;
		}
		.source-section {
			width: 100%;
		}
		.metadata {
			width: 100%;
		}
		.history {
			width: 100%;
			margin: 0;
		}
		.manage {
			width: auto;
		}
		.name-line h1 {
			font-size: 25px;
		}
		.detail-icon {
			width: 45px;
			height: 50px;
		}
		.detail-heading {
			gap: 13px;
		}
		.file-body {
			padding: 18px;
		}
		.related .section-heading {
			flex-direction: column;
		}
	}
</style>
