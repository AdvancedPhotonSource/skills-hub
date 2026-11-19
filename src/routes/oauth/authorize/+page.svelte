<script lang="ts">
	import { Plug, Check, X } from '@lucide/svelte';
	let { data } = $props();
</script>

<svelte:head><title>Connect an agent · APS Skills Hub</title></svelte:head>
<section class="auth-page">
	<div class="consent-icon"><Plug size={26} strokeWidth={1.5} /></div>
	<h1>Connect <span>{data.clientName}</span>?</h1>
	<p class="lede">
		It is asking to use the APS Skills Hub as <strong>{data.account}</strong>.
	</p>
	<div class="form-card">
		<h2>This will let it</h2>
		<ul>
			{#each data.scopes as scope}
				<li><Check size={15} />{scope.label}</li>
			{/each}
		</ul>
		<p class="small-text muted">
			It cannot publish, edit or delete anything, and it only ever sees entries you could already
			open yourself.
		</p>
	</div>
	<div class="decide">
		<form method="POST" action="?/approve" data-sveltekit-reload>
			<button class="button primary" type="submit">Connect</button>
		</form>
		<form method="POST" action="?/deny" data-sveltekit-reload>
			<button class="button" type="submit"><X size={15} />Cancel</button>
		</form>
	</div>
	<p class="small-text muted">Only continue if you just asked this application to connect.</p>
</section>

<style>
	.consent-icon {
		display: grid;
		place-items: center;
		width: 52px;
		height: 52px;
		border-radius: var(--radius);
		background: var(--paper);
		border: 1px solid var(--line);
		color: var(--blue);
		margin-bottom: 18px;
	}
	h1 span {
		color: var(--blue);
	}
	.lede {
		margin-bottom: 22px;
	}
	ul {
		list-style: none;
		padding: 0;
		margin: 0 0 14px;
		display: grid;
		gap: 9px;
	}
	li {
		display: flex;
		gap: 9px;
		align-items: center;
		font-size: 14px;
	}
	li :global(svg) {
		color: var(--green, var(--blue));
		flex: none;
	}
	.decide {
		display: flex;
		gap: 10px;
		margin: 22px 0 14px;
	}
	.decide button {
		display: inline-flex;
		align-items: center;
		gap: 6px;
	}
</style>
