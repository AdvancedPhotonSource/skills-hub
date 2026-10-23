<script lang="ts">
	import { base } from '$app/paths';
	import { Search, SlidersHorizontal, ArrowRight, Layers, X, Sparkles } from '@lucide/svelte';
	import SkillList from '$lib/components/SkillList.svelte';
	import { categoryName, roles } from '$lib/taxonomy';
	let { data } = $props();
	let showFilters = $state(false);
	const urlWith = (key: string, value: string) => {
		const params = new URLSearchParams(data.filters);
		params.delete('page');
		if (value) params.set(key, value);
		else params.delete(key);
		return `${base}/?${params}`;
	};
	let activeFilters = $derived(
		Object.entries(data.filters).filter(
			([key, value]) => value && !['page', 'sort', 'q'].includes(key)
		)
	);
	let searching = $derived(Boolean(data.query || activeFilters.length));
</script>

<svelte:head
	><title>{data.query ? `${data.query} · ` : ''}Explore · APS Skills Hub</title></svelte:head
>
<section class="hero" class:compact={searching}>
	<div class="shell hero-inner">
		<div class="hero-copy">
			{#if !searching}<div class="eyebrow">
					<span class="status-dot"></span> Expertise, shared across Argonne
				</div>{/if}
			<h1>
				{#if searching}Search the library.{:else}Find the skill for<br />your next task.{/if}
			</h1>
			{#if !searching}<p>
					Reusable instructions for your AI agents.<br class="desktop-break" /> Built by colleagues. Ready
					for science, code, and everyday work.
				</p>{/if}
			<form class="search-box" action={`${base}/`} method="GET" role="search">
				{#each Object.entries(data.filters).filter(([key]) => !['q', 'page'].includes(key)) as [key, value]}<input
						type="hidden"
						name={key}
						{value}
					/>{/each}
				<Search size={20} /><label class="sr-only" for="search">Search skills</label><input
					id="search"
					name="q"
					value={data.query}
					placeholder="Search a task, tool, or skill…"
					maxlength="200"
				/><button type="submit" aria-label="Search"><ArrowRight size={20} /></button>
			</form>
			<div class="suggestions">
				<span>Try</span>{#each ['Python', 'EPICS', 'HDF5'] as keyword}<a
						href={`${base}/?q=${keyword}`}>{keyword}</a
					>{/each}
			</div>
		</div>
		{#if !searching}<div class="hero-note">
				<div class="note-icon"><Layers size={24} strokeWidth={1.5} /></div>
				<h2>A little expertise.<br />A better starting point.</h2>
				<p>Explore a skill, read the instructions, and bring it into the tools you already use.</p>
				<a href={`${base}/categories`}>Browse by category <ArrowRight size={15} /></a>
			</div>{/if}
	</div>
</section>

<div class="shell catalog-layout">
	<aside id="skill-filters" class:visible={showFilters} aria-label="Skill filters">
		<div class="filter-title">
			<h2>Browse skills</h2>
			<SlidersHorizontal size={15} />
		</div>
		<a class="category-link" class:selected={!data.filters.category} href={urlWith('category', '')}
			><span>All categories</span></a
		>
		{#each data.taxonomy.filter((c) => !c.parent) as category}<a
				class="category-link"
				class:selected={data.filters.category === category.id ||
					data.taxonomy.some((c) => c.id === data.filters.category && c.parent === category.id)}
				href={urlWith('category', category.id)}
				><span>{category.name}</span><span>{category.count}</span></a
			>
			{#if data.filters.category === category.id || data.taxonomy.some((c) => c.id === data.filters.category && c.parent === category.id)}<div
					class="subcategories"
				>
					{#each data.taxonomy.filter((c) => c.parent === category.id) as child}<a
							class:selected={data.filters.category === child.id}
							href={urlWith('category', child.id)}>{child.name}<span>{child.count}</span></a
						>{/each}
				</div>{/if}
		{/each}
		<form method="GET" action={`${base}/`} class="secondary-filters">
			{#each Object.entries(data.filters).filter(([key]) => !['role', 'days', 'exact', 'page'].includes(key)) as [key, value]}<input
					type="hidden"
					name={key}
					{value}
				/>{/each}
			<div class="field">
				<label for="role">Role</label><select name="role" id="role" value={data.filters.role || ''}
					><option value="">All roles</option>{#each roles as role}<option>{role}</option
						>{/each}</select
				>
			</div>
			<div class="field">
				<label for="days">Updated</label><select
					name="days"
					id="days"
					value={data.filters.days || ''}
					><option value="">Any time</option><option value="7">Past week</option><option value="30"
						>Past month</option
					><option value="90">Past 90 days</option><option value="365">Past year</option></select
				>
			</div>
			<label class="check-label"
				><input type="checkbox" name="exact" value="1" checked={data.filters.exact === '1'} /> Exact skill
				name</label
			><button class="button small" type="submit">Apply filters</button>
		</form>
		<div class="contribute">
			<Sparkles size={17} />
			<h3>Have a workflow worth sharing?</h3>
			<p>Turn what you know into a skill others can use.</p>
			<a href={`${base}/upload`}>Share a skill <ArrowRight size={13} /></a>
		</div>
	</aside>
	<section class="results" aria-label="Search results">
		<div class="results-toolbar">
			<div>
				<h2>
					{data.query
						? `Results for “${data.query}”`
						: data.filters.category
							? categoryName(data.filters.category)
							: data.filters.author
								? `Skills by ${data.filters.author}`
								: 'Explore the library'}
				</h2>
				<p>
					{data.total}
					{data.total === 1 ? 'skill' : 'skills'}{data.query || activeFilters.length
						? ' found'
						: ' to build on'}
				</p>
			</div>
			<div class="result-actions">
				<button
					class="button small filter-toggle"
					aria-expanded={showFilters}
					aria-controls="skill-filters"
					onclick={() => (showFilters = !showFilters)}
					><SlidersHorizontal size={14} /> Filters</button
				>
				<form method="GET" action={`${base}/`}>
					{#each Object.entries(data.filters).filter(([key]) => !['sort', 'page'].includes(key)) as [key, value]}<input
							type="hidden"
							name={key}
							{value}
						/>{/each}<label class="sr-only" for="sort">Sort skills</label><select
						name="sort"
						id="sort"
						value={data.filters.sort || 'relevance'}
						onchange={(e) => e.currentTarget.form?.requestSubmit()}
						><option value="relevance">{data.query ? 'Relevance' : 'Recently updated'}</option
						>{#if data.query}<option value="recent">Recently updated</option>{/if}<option
							value="downloads">Most downloaded</option
						></select
					><noscript><button type="submit">Sort</button></noscript>
				</form>
			</div>
		</div>
		{#if activeFilters.length}<div class="active-filters">
				{#each activeFilters as [key, value]}<a class="badge blue" href={urlWith(key, '')}
						>{key === 'category'
							? categoryName(value)
							: key === 'exact'
								? 'Exact name'
								: key === 'days'
									? `Past ${value} days`
									: value}<X size={12} /></a
					>{/each}<a class="small-text" href={`${base}/?q=${encodeURIComponent(data.query)}`}
					>Clear filters</a
				>
			</div>{/if}
		{#if data.skills.length}<SkillList skills={data.skills} />{:else}<div class="empty">
				<Search size={30} />
				<h2>
					{data.query || activeFilters.length
						? 'No matching skills yet'
						: 'Your shared library starts here'}
				</h2>
				<p>
					{data.query || activeFilters.length
						? 'Try a broader search or remove a filter to explore more of the library.'
						: 'Publish the first skill to give your colleagues a useful starting point.'}
				</p>
				<a class="button" href={`${base}/${data.query || activeFilters.length ? '' : 'upload'}`}
					>{data.query || activeFilters.length ? 'Explore all skills' : 'Upload a skill'}</a
				>
			</div>{/if}
		{#if data.pages > 1}<div class="pagination">
				<a href={`${urlWith('page', String(data.page - 1))}`} class:disabled={data.page <= 1}
					>Previous</a
				><span>Page {data.page} of {data.pages}</span>{#if data.page < data.pages}<a
						href={urlWith('page', String(data.page + 1))}>Next</a
					>{/if}
			</div>{/if}
		<div class="library-note">
			<Layers size={16} /><span
				>Skills are portable folders built around a <code>SKILL.md</code> file. Download one and add it
				to your agent’s skills directory.</span
			>
		</div>
	</section>
</div>

<style>
	.hero {
		background: linear-gradient(110deg, #f7faff 0%, #f9fbfe 65%, #f0f5fd 100%);
		border-bottom: 1px solid var(--line);
	}
	.hero-inner {
		display: flex;
		justify-content: space-between;
		gap: 70px;
		align-items: center;
		padding-block: 48px 36px;
	}
	.hero-copy {
		flex: 1;
		max-width: 690px;
	}
	.status-dot {
		width: 6px;
		height: 6px;
		border-radius: 50%;
		background: #3b75ca;
	}
	.hero h1 {
		font-size: 43px;
		letter-spacing: -1.5px;
		margin-bottom: 17px;
		line-height: 1.15;
	}
	.hero-copy > p {
		color: #758095;
		font-size: 14px;
		line-height: 1.8;
		margin-bottom: 25px;
	}
	.search-box {
		display: flex;
		gap: 12px;
		align-items: center;
		background: white;
		border: 1px solid #d0dcea;
		border-radius: 8px;
		padding: 7px 8px 7px 17px;
		box-shadow: 0 3px 9px #263d6810;
		max-width: 635px;
	}
	.search-box > :global(svg) {
		color: #7b8ea7;
	}
	.search-box input {
		border: 0;
		background: none;
		outline: none;
		padding: 8px 0;
		min-width: 0;
		flex: 1;
		font-size: 14px;
	}
	.search-box:focus-within {
		outline: 2px solid #a2bfe7;
	}
	.search-box button {
		display: flex;
		align-items: center;
		justify-content: center;
		background: var(--blue);
		border: 0;
		color: white;
		width: 38px;
		height: 38px;
	}
	.suggestions {
		display: flex;
		gap: 9px;
		align-items: center;
		font-size: 11px;
		margin-top: 13px;
		color: #8895a7;
	}
	.suggestions > a {
		background: #eaf0f8;
		border-radius: 4px;
		padding: 2px 9px;
		color: var(--muted);
	}
	.hero-note {
		max-width: 270px;
		border-left: 1px solid #dce5f1;
		padding-left: 34px;
		margin-right: 30px;
	}
	.note-icon {
		color: #6e8eb7;
		margin-bottom: 17px;
	}
	.hero-note h2 {
		font-size: 20px;
		color: #405878;
		letter-spacing: -0.4px;
		line-height: 1.4;
	}
	.hero-note p {
		font-size: 12px;
		line-height: 1.8;
		color: #8190a5;
	}
	.hero-note a {
		font-size: 12px;
		display: flex;
		align-items: center;
		gap: 9px;
		font-weight: 550;
	}
	.catalog-layout {
		display: grid;
		grid-template-columns: 235px minmax(0, 1fr);
		gap: 48px;
		padding-top: 38px;
	}
	.filter-title {
		display: flex;
		justify-content: space-between;
		align-items: center;
		color: #8b98a9;
		margin: 3px 0 17px;
	}
	.filter-title h2 {
		font-size: 13px;
		color: #3d4c60;
		letter-spacing: 0;
		margin: 0;
	}
	.category-link {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 6px;
		padding: 9px 10px;
		margin: 3px -10px;
		color: var(--muted);
		font-size: 12px;
		border-radius: 5px;
	}
	.category-link > span:nth-child(2) {
		font-size: 10px;
		color: var(--muted);
		min-width: 20px;
		text-align: center;
	}
	.category-link.selected {
		background: #edf3fd;
		color: #245faf;
		font-weight: 600;
	}
	.category-link:hover {
		text-decoration: none;
		background: #f3f6fa;
	}
	.subcategories {
		padding-left: 12px;
		border-left: 1px solid #dce6f4;
		margin: 6px 0;
	}
	.subcategories > a {
		display: flex;
		justify-content: space-between;
		padding: 5px 0 5px 10px;
		font-size: 11px;
		color: var(--muted);
	}
	.subcategories > a.selected {
		color: var(--blue);
		font-weight: 600;
	}
	.secondary-filters {
		border-top: 1px solid var(--line);
		padding-top: 21px;
		margin-top: 21px;
	}
	.secondary-filters .field {
		margin-bottom: 16px;
	}
	.secondary-filters label {
		font-size: 11px;
	}
	.secondary-filters select {
		font-size: 12px;
		padding: 8px;
	}
	.check-label {
		display: flex;
		align-items: center;
		gap: 7px;
		color: var(--muted);
		margin-bottom: 17px;
	}
	.contribute {
		border-top: 1px solid var(--line);
		padding-top: 23px;
		margin-top: 26px;
		color: #7c8fa9;
	}
	.contribute h3 {
		font-size: 12px;
		line-height: 1.7;
		color: #52647e;
		margin: 9px 0;
	}
	.contribute p {
		font-size: 12px;
		color: var(--muted);
		line-height: 1.8;
	}
	.contribute a {
		display: flex;
		align-items: center;
		gap: 8px;
		font-size: 12px;
	}
	.results-toolbar {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 20px;
		margin-bottom: 21px;
	}
	.results-toolbar h2 {
		font-size: 20px;
		margin-bottom: 4px;
		overflow-wrap: anywhere;
	}
	.results-toolbar p {
		font-size: 12px;
		color: var(--muted);
		margin: 0;
	}
	.result-actions {
		display: flex;
		align-items: center;
		gap: 10px;
	}
	.result-actions select {
		font-size: 11px;
		border-color: var(--line);
		padding: 8px;
		background: #fff;
	}
	.filter-toggle {
		display: none;
	}
	.active-filters {
		display: flex;
		align-items: center;
		gap: 8px;
		flex-wrap: wrap;
		margin-bottom: 16px;
	}
	.active-filters a {
		gap: 8px;
	}
	.library-note {
		display: flex;
		gap: 10px;
		align-items: flex-start;
		padding-top: 24px;
		color: var(--muted);
		font-size: 11px;
		line-height: 1.8;
	}
	.library-note :global(svg) {
		margin-top: 2px;
	}
	.library-note code {
		font-size: 11px;
	}
	.disabled {
		pointer-events: none;
		opacity: 0.4;
	}
	.compact .hero-inner {
		padding-block: 28px;
	}
	.compact h1 {
		font-size: 28px;
		letter-spacing: -0.7px;
	}
	@media (max-width: 1000px) {
		.hero-note {
			margin-right: 0;
			max-width: 240px;
		}
		.hero-inner {
			gap: 40px;
		}
		.catalog-layout {
			grid-template-columns: 205px minmax(0, 1fr);
			gap: 30px;
		}
	}
	@media (max-width: 760px) {
		.hero-inner {
			padding-block: 32px 26px;
		}
		.hero h1 {
			font-size: 36px;
		}
		.hero-note {
			display: none;
		}
		.hero-copy {
			max-width: 100%;
		}
		.catalog-layout {
			display: block;
			padding-top: 26px;
		}
		.catalog-layout > aside {
			display: none;
			margin-bottom: 30px;
			background: var(--surface);
			padding: 20px;
			border-radius: 8px;
		}
		.catalog-layout > aside.visible {
			display: block;
		}
		.contribute {
			display: none;
		}
		.filter-toggle {
			display: inline-flex;
		}
		.results-toolbar {
			align-items: flex-start;
			gap: 10px;
		}
		.results-toolbar h2 {
			font-size: 18px;
		}
		.result-actions {
			flex-direction: column;
			align-items: flex-end;
		}
		.desktop-break {
			display: none;
		}
	}
</style>
