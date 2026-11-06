<script lang="ts">
	import { base } from '$app/paths';
	import { ArrowRight } from '@lucide/svelte';
	let {
		entraEnabled = false,
		ssoError = null
	}: {
		entraEnabled?: boolean;
		ssoError?: string | null;
	} = $props();
</script>

<svelte:head><title>Sign in · APS Skills Hub</title></svelte:head>
<section class="auth-page">
	<div class="eyebrow">APS Skills Hub</div>
	<h1>Sign in with Argonne.</h1>
	<p>Use your Argonne credentials to access the Skills Hub.</p>
	{#if ssoError}<div class="notice error" role="alert">{ssoError}</div>{/if}
	<div class="form-card">
		{#if entraEnabled}
			<a class="button primary" href={`${base}/auth/entra`} data-sveltekit-reload
				>Sign in with Argonne <ArrowRight size={16} /></a
			>
			<p class="small-text muted">
				An Argonne SSO session is required to browse, download, or contribute.
			</p>
		{:else}
			<p class="notice" role="alert">
				Argonne sign-in is not configured. Please contact the hub administrator.
			</p>
		{/if}
	</div>
</section>
