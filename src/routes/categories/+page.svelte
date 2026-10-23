<script lang="ts">
	import { base } from '$app/paths';
	import { ArrowUpRight, Layers } from '@lucide/svelte';
	let { data } = $props();
</script>

<svelte:head><title>Categories · APS Skills Hub</title></svelte:head>
<div class="shell">
	<div class="page-head">
		<div class="eyebrow"><Layers size={16} /> Explore by discipline</div>
		<h1>Expertise across the laboratory.</h1>
		<p>
			Start with your field, or find a useful approach in another. A skill can belong to more than
			one category.
		</p>
	</div>
	<div class="category-grid">
		{#each data.taxonomy.filter((c) => !c.parent) as domain}<section>
				<div class="domain-head">
					<a href={`${base}/?category=${domain.id}`}
						><h2>{domain.name}</h2>
						<ArrowUpRight size={17} /></a
					><span>{domain.count} {domain.count === 1 ? 'skill' : 'skills'}</span>
				</div>
				<ul>
					{#each data.taxonomy.filter((c) => c.parent === domain.id) as category}<li>
							<a href={`${base}/?category=${category.id}`}
								>{category.name}<span>{category.count}</span></a
							>
						</li>{/each}
				</ul>
			</section>{/each}
	</div>
</div>

<style>
	.category-grid {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: 24px;
	}
	.category-grid > section {
		border: 1px solid var(--line);
		border-radius: 8px;
		padding: 24px;
	}
	.domain-head > a {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 10px;
		color: #324866;
	}
	.domain-head h2 {
		font-size: 16px;
		margin: 0;
		line-height: 1.5;
	}
	.domain-head > span {
		display: block;
		font-size: 11px;
		color: var(--muted);
		margin-top: 7px;
	}
	ul {
		list-style: none;
		padding: 17px 0 0;
		margin: 17px 0 0;
		border-top: 1px solid var(--line);
	}
	li > a {
		display: flex;
		justify-content: space-between;
		gap: 10px;
		padding: 8px 0;
		font-size: 12px;
		color: var(--muted);
	}
	li span {
		color: var(--muted);
	}
	@media (max-width: 1000px) {
		.category-grid {
			grid-template-columns: repeat(2, minmax(0, 1fr));
		}
	}
	@media (max-width: 600px) {
		.category-grid {
			grid-template-columns: 1fr;
		}
	}
</style>
