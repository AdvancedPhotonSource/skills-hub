<script lang="ts">
	import { base } from '$app/paths';
	let { data } = $props();
</script>

<svelte:head><title>Account · APS Skills Hub</title></svelte:head>
<section class="auth-page">
	<h1>Your account</h1>
	<p>{data.account.displayName} <span class="badge">{data.account.username}</span></p>
	{#if data.entra}
		<div class="form-card" style="margin-bottom: 24px">
			<h2>Linked Argonne account</h2>
			<p>{data.entra.username || 'Argonne identity linked.'}</p>
			{#if data.entra.email && data.entra.email !== data.entra.username}<p>
					{data.entra.email}
				</p>{/if}
			<p class="small-text muted">
				Your contributions remain attached to this Hub account, even if your Argonne username
				changes.
			</p>
		</div>
	{/if}
	<p>All Argonne SSO users can publish skills and MCPs.</p>
	<p>Sign-in and password management are handled by Argonne.</p>
	<form method="POST" action={`${base}/sign-out`} style="margin-top: 24px">
		<button class="button">Sign out</button>
	</form>
</section>
