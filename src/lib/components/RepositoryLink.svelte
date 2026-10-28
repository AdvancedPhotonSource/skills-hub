<script lang="ts">
	import { GitBranch, ExternalLink } from '@lucide/svelte';
	let {
		href,
		label,
		embedded = false
	}: { href: string; label?: string; embedded?: boolean } = $props();
	const github = $derived(new URL(href).hostname === 'github.com');
</script>

<a class="repository-link" class:embedded {href} target="_blank" rel="noreferrer">
	<GitBranch size={18} /><span>
		<strong>{github ? 'View on GitHub' : 'View repository'}</strong>
		<small>{label || href.replace(/^https?:\/\//, '').replace(/^github\.com\//, '')}</small>
	</span><ExternalLink size={13} />
</a>

<style>
	.repository-link {
		display: flex;
		align-items: center;
		gap: 10px;
		border: 1px solid #d7e2ef;
		border-top: 3px solid var(--argonne-blue);
		border-radius: 14px;
		background: #fff;
		box-shadow: 0 8px 28px #20395508;
		padding: 22px;
		color: #384e6e;
		min-width: 0;
	}
	.embedded {
		border: 0;
		border-top: 1px solid var(--line);
		border-radius: 0;
		box-shadow: none;
		margin-top: 18px;
		padding: 18px 0 0;
	}
	span {
		flex: 1;
		min-width: 0;
	}
	strong {
		display: block;
		font-size: 12px;
		font-weight: 600;
	}
	small {
		display: block;
		font-size: 10px;
		color: var(--muted);
		overflow-wrap: anywhere;
		margin-top: 3px;
	}
	@media (max-width: 900px) {
		.repository-link:not(.embedded) {
			order: -1;
			width: 100%;
		}
	}
</style>
