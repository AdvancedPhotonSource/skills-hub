<script lang="ts">
	import '../app.css';
	import { base } from '$app/paths';
	import { page } from '$app/state';
	import { Upload, Menu, X } from '@lucide/svelte';
	let { data, children } = $props();
	let menu = $state(false);
</script>

<svelte:head
	><title>APS Skills Hub</title><meta
		name="description"
		content="Discover and share agent skills for science, engineering, and everyday work at Argonne."
	/></svelte:head
>
<a class="skip-link" href="#main">Skip to content</a>
<div class="institution">
	<div class="shell">
		<span>Advanced Photon Source</span><span>Argonne National Laboratory</span>
	</div>
</div>
<header class="site-header">
	<div class="shell header-inner">
		<a class="brand" href={`${base}/`} aria-label="APS Skills Hub home"
			><img src={`${base}/favicon.svg`} width="36" height="36" alt="" /><span
				>APS <strong>Skills Hub</strong></span
			></a
		>
		<button
			class="icon-button mobile-menu"
			aria-label={menu ? 'Close navigation' : 'Open navigation'}
			aria-expanded={menu}
			onclick={() => (menu = !menu)}
			>{#if menu}<X size={22} />{:else}<Menu size={22} />{/if}</button
		>
		<nav class:open={menu} aria-label="Main navigation">
			{#each [['/', 'Explore'], ['/categories', 'Categories'], ['/saved', 'Saved']] as [path, label]}
				<a
					class:active={page.url.pathname === `${base}${path}`}
					href={`${base}${path}`}
					onclick={() => (menu = false)}>{label}</a
				>
			{/each}
			{#if data.user}<a
					class:active={page.url.pathname === `${base}/my-skills`}
					href={`${base}/my-skills`}
					onclick={() => (menu = false)}>My skills</a
				>{/if}
			<a class="button primary small" href={`${base}/upload`} onclick={() => (menu = false)}
				><Upload size={15} /> Upload skill</a
			>
			{#if data.user}
				<a
					class="account-link"
					href={`${base}/account`}
					onclick={() => (menu = false)}
					aria-label={`Account: ${data.user.username}`}
					><span class="avatar">{data.user.displayName.slice(0, 1).toUpperCase()}</span><span
						class="account-name">{data.user.username}</span
					></a
				>
			{:else}<a href={`${base}/sign-in`} onclick={() => (menu = false)}>Sign in</a>{/if}
		</nav>
	</div>
</header>
<main id="main">{@render children()}</main>
<footer class="site-footer shell">
	<span>APS Skills Hub <span class="footer-divider">/</span> Built for shared expertise.</span>
	<div><a href={`${base}/docs/api`}>API Docs</a><span>Argonne internal</span></div>
</footer>
