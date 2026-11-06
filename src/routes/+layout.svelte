<script lang="ts">
	import '../app.css';
	import argonneLogo from '$lib/argonne-logo.svg?raw';
	import { base } from '$app/paths';
	import { page } from '$app/state';
	import { Upload, Menu, X, Moon, Sun } from '@lucide/svelte';
	import { onMount } from 'svelte';
	import { setPreference } from '$lib/preferences';
	let { data, children } = $props();
	let menu = $state(false);
	let dark = $state(false);
	onMount(() => {
		dark = document.documentElement.dataset.theme === 'dark';
	});
</script>

<svelte:head
	><title>APS Skills Hub</title><meta
		name="description"
		content="Discover skills and MCPs for beamline controls and scientific analysis at Argonne’s Advanced Photon Source."
	/></svelte:head
>
<a class="skip-link" href="#main">Skip to content</a>
<div class="institution">
	<div class="shell">
		<a href="https://www.anl.gov/" aria-label="Argonne National Laboratory">{@html argonneLogo}</a>
		<div class="institution-actions">
			<span>Advanced Photon Source</span>
			<button
				class="icon-button"
				aria-label="Dark mode"
				aria-pressed={dark}
				title={dark ? 'Switch to light mode' : 'Switch to dark mode'}
				onclick={() => {
					dark = !dark;
					setPreference('theme', dark ? 'dark' : 'light');
				}}
				>{#if dark}<Sun size={18} />{:else}<Moon size={18} />{/if}</button
			>
		</div>
	</div>
</div>
<header class="site-header">
	<div class="shell header-inner">
		<a class="brand" href={`${base}/`} aria-label="APS Skills Hub home"
			><span>APS <strong>Skills Hub</strong></span></a
		>
		{#if data.user}
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
				<a
					class:active={page.url.pathname === `${base}/my-skills`}
					href={`${base}/my-skills`}
					onclick={() => (menu = false)}>My contributions</a
				>
				<a class="button primary small" href={`${base}/upload`} onclick={() => (menu = false)}
					><Upload size={15} /> Publish</a
				>
				<a
					class="account-link"
					href={`${base}/account`}
					onclick={() => (menu = false)}
					aria-label={`Account: ${data.user.username}`}
					><span class="avatar">{data.user.displayName.slice(0, 1).toUpperCase()}</span><span
						class="account-name">{data.user.username}</span
					></a
				>
			</nav>
		{/if}
	</div>
</header>
<main id="main">{@render children()}</main>
<footer class="site-footer shell">
	<span>APS Skills Hub <span class="footer-divider">/</span> Built for shared expertise.</span>
	<div>
		{#if data.user}<a href={`${base}/docs/api`}>API Docs</a>{/if}<span>Argonne internal</span>
	</div>
</footer>
