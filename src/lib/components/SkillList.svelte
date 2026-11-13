<script lang="ts">
	import { base } from '$app/paths';
	import {
		FileText,
		Plug,
		Layers,
		ArrowUpRight,
		Download,
		GitBranch,
		ExternalLink
	} from '@lucide/svelte';
	import { categoryName, categoryTone, provenanceName } from '$lib/taxonomy';
	import { repositoryUrl } from '$lib/source';
	import type { Skill } from '$lib/types';
	import OwnerLinks from './OwnerLinks.svelte';
	let { skills }: { skills: Skill[] } = $props();
</script>

<div class="skill-list">
	{#each skills as skill}
		{@const repository =
			skill.mcp?.repository || skill.sourceUrl || (skill.source ? repositoryUrl(skill.source) : '')}
		<article class="skill-row" class:collection-row={skill.applicationType === 'collection'}>
			<div class="skill-icon tone" data-tone={categoryTone(skill.categories[0])}>
				{#if skill.applicationType === 'collection'}<Layers
						size={19}
						strokeWidth={1.6}
					/>{:else if skill.applicationType === 'mcp'}<Plug
						size={19}
						strokeWidth={1.6}
					/>{:else}<FileText size={19} strokeWidth={1.6} />{/if}
			</div>
			<div class="skill-body">
				{#if skill.applicationType === 'collection'}<div class="collection-label">
						<Layers size={14} /> Collection <span>{skill.memberCount} entries</span>
					</div>{/if}
				<div class="title-row">
					<a class="skill-name" href={`${base}/skills/${skill.id}`}
						>{skill.collectionTitle || skill.name}<ArrowUpRight size={15} /></a
					>{#if skill.applicationType === 'mcp'}<span class="badge blue">MCP</span
						>{/if}{#if skill.provenance !== 'argonne'}<span class="badge"
							>{provenanceName[skill.provenance]}</span
						>{/if}
				</div>
				<p>{skill.description}</p>
				<div class="skill-meta">
					<OwnerLinks owners={skill.owners} /><span class="meta-divider"
					></span>{#each skill.categories.slice(0, 2) as category}<a
							class="category category-chip"
							data-tone={categoryTone(category)}
							href={`${base}/?category=${category}`}>{categoryName(category)}</a
						>{/each}
				</div>
			</div>
			{#if repository}
				{@const directory = new URL(repository).pathname.match(/\/(?:-\/)?tree\/[^/]+\/(.+)/)?.[1]}
				<a
					class="card-repository"
					href={repository}
					target="_blank"
					rel="noreferrer"
					title={`Source repository: ${repository}`}
				>
					<GitBranch size={15} />
					<span
						>{directory ||
							repository
								.replace(/^https?:\/\//, '')
								.replace(/^(github\.com|gitlab\.osti\.gov)\//, '')
								.replace(/\/$/, '')}</span
					>
					<ExternalLink size={12} />
				</a>
			{/if}
			<div class="skill-stats">
				<span><Download size={12} />{skill.downloads}</span><time datetime={skill.updatedAt}
					>{new Date(skill.updatedAt).toLocaleDateString('en-US', {
						month: 'short',
						day: 'numeric',
						timeZone: 'UTC'
					})}</time
				>
			</div>
		</article>
	{/each}
</div>

<style>
	.collection-label {
		display: flex;
		align-items: center;
		gap: 7px;
		margin-bottom: 12px;
		color: var(--blue);
		font-size: 10px;
		font-weight: 650;
		letter-spacing: 0.08em;
		text-transform: uppercase;
	}
	.collection-label span {
		margin-left: auto;
		color: var(--muted);
		letter-spacing: 0;
		text-transform: none;
		font-weight: 400;
	}
	.collection-row {
		background: linear-gradient(135deg, var(--blue-light), transparent 75%);
	}
	:global([data-view='grid']) .skill-row.collection-row {
		border-top: 3px solid var(--blue);
		box-shadow:
			0 4px 0 -1px var(--surface),
			0 5px 0 -1px var(--line);
	}
	:global([data-view='grid']) .skill-list {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(min(100%, 260px), 1fr));
		gap: 16px;
		border: 0;
	}
	:global([data-view='grid']) .skill-row {
		position: relative;
		isolation: isolate;
		flex-direction: column;
		padding: 20px;
		border: 1px solid var(--line);
		border-radius: var(--radius);
	}
	:global([data-view='grid']) .skill-name::after {
		content: '';
		position: absolute;
		inset: 0;
		z-index: 1;
		border-radius: var(--radius);
	}
	:global([data-view='grid']) .skill-name:focus-visible::after {
		outline: 2px solid var(--blue);
		outline-offset: 3px;
	}
	:global([data-view='grid']) .skill-meta a,
	:global([data-view='grid']) .card-repository {
		position: relative;
		z-index: 2;
	}
	:global([data-view='grid']) .card-repository {
		display: flex;
	}
	.card-repository {
		display: none;
		align-items: center;
		gap: 8px;
		min-width: 0;
		padding: 8px 10px;
		border: 1px solid var(--line);
		border-radius: 6px;
		background: var(--surface);
		color: var(--muted);
		font-size: 11px;
	}
	.card-repository span {
		flex: 1;
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.card-repository :global(svg) {
		color: var(--blue);
	}
	.card-repository:hover {
		background: var(--blue-light);
		color: var(--blue);
		text-decoration: none;
	}
	:global([data-view='grid']) .skill-icon {
		display: none;
	}
	:global([data-view='grid']) .title-row {
		flex-wrap: wrap;
	}
	:global([data-view='grid']) .skill-body p {
		-webkit-line-clamp: 3;
		line-clamp: 3;
	}
	:global([data-view='grid']) .skill-stats {
		display: flex;
		flex-direction: row;
		justify-content: space-between;
	}
	.skill-list {
		border-top: 1px solid var(--line);
	}
	.skill-row {
		display: flex;
		gap: 17px;
		padding: 24px 0;
		border-bottom: 1px solid var(--line);
	}
	.skill-row:hover {
		background: var(--surface);
	}
	.skill-icon {
		display: flex;
		align-items: center;
		justify-content: center;
		background: var(--tone-bg);
		border: 1px solid var(--tone-line);
		color: var(--tone);
		width: 42px;
		height: 46px;
		flex-shrink: 0;
		border-radius: 7px;
	}
	.skill-body {
		min-width: 0;
		flex: 1;
	}
	.title-row {
		display: flex;
		align-items: center;
		gap: 12px;
	}
	.skill-name {
		display: inline-flex;
		align-items: center;
		gap: 7px;
		font-size: 16px;
		font-weight: 650;
		color: light-dark(#273b57, var(--text));
		letter-spacing: -0.2px;
		overflow-wrap: anywhere;
	}
	.skill-name :global(svg) {
		color: #99a9bd;
	}
	.skill-name:hover {
		color: var(--blue);
		text-decoration: none;
	}
	.skill-body p {
		font-size: 13px;
		color: var(--muted);
		line-height: 1.65;
		margin: 6px 0 11px;
		display: -webkit-box;
		-webkit-line-clamp: 2;
		line-clamp: 2;
		-webkit-box-orient: vertical;
		overflow: hidden;
	}
	.skill-meta {
		display: flex;
		align-items: center;
		flex-wrap: wrap;
		gap: 9px;
		font-size: 11px;
		color: var(--muted);
	}
	.skill-meta > a {
		color: var(--muted);
	}
	.skill-meta .category {
		background: var(--tone-bg);
		padding: 2px 7px;
		border-radius: 3px;
		color: var(--tone);
	}
	.meta-divider {
		height: 12px;
		width: 1px;
		background: var(--line);
		margin-inline: 3px;
	}
	.skill-stats {
		display: flex;
		flex-direction: column;
		align-items: flex-end;
		gap: 24px;
		padding-top: 5px;
		min-width: 60px;
		font-size: 11px;
		color: var(--muted);
	}
	.skill-stats > span {
		display: flex;
		align-items: center;
		gap: 5px;
	}
	@media (max-width: 600px) {
		.skill-row {
			gap: 12px;
			padding: 20px 0;
		}
		.skill-icon {
			width: 34px;
			height: 38px;
		}
		.skill-stats {
			display: none;
		}
		.skill-name {
			font-size: 15px;
		}
	}
</style>
