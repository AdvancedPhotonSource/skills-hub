<script lang="ts">
	import { base } from '$app/paths';
	import { FileText, ArrowUpRight, Download } from '@lucide/svelte';
	import { categoryName } from '$lib/taxonomy';
	import type { Skill } from '$lib/types';
	let { skills }: { skills: Skill[] } = $props();
</script>

<div class="skill-list">
	{#each skills as skill}
		<article class="skill-row">
			<div class="skill-icon"><FileText size={19} strokeWidth={1.6} /></div>
			<div class="skill-body">
				<div class="title-row">
					<a class="skill-name" href={`${base}/skills/${skill.id}`}
						>{skill.name}<ArrowUpRight size={15} /></a
					>{#if skill.archived}<span class="badge">Archived</span>{/if}
				</div>
				<p>{skill.description}</p>
				<div class="skill-meta">
					<a href={`${base}/?author=${encodeURIComponent(skill.username)}`}>{skill.displayName}</a
					><span class="meta-divider"></span>{#each skill.categories.slice(0, 2) as category}<a
							class="category"
							href={`${base}/?category=${category}`}>{categoryName(category)}</a
						>{/each}
				</div>
			</div>
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
	.skill-list {
		border-top: 1px solid var(--line);
	}
	.skill-row {
		display: flex;
		gap: 17px;
		padding: 24px 0;
		border-bottom: 1px solid var(--line);
	}
	.skill-icon {
		display: flex;
		align-items: center;
		justify-content: center;
		background: #f0f5fd;
		border: 1px solid #e2eafa;
		color: #4776b7;
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
		color: #273b57;
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
		color: #6b7788;
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
		color: #7d8897;
	}
	.skill-meta > a {
		color: #63738a;
	}
	.skill-meta .category {
		background: #f4f6f9;
		padding: 2px 7px;
		border-radius: 3px;
		color: #657187;
	}
	.meta-divider {
		height: 12px;
		width: 1px;
		background: #dce2ea;
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
