<script lang="ts">
	import { enhance } from '$app/forms';
	import { base } from '$app/paths';
	import { ArrowRight } from '@lucide/svelte';
	let { register = false, form }: { register?: boolean; form?: { message?: string } | null } =
		$props();
	let pending = $state(false);
	let username = $state('');
	let displayName = $state('');
	let password = $state('');
</script>

<svelte:head><title>{register ? 'Create account' : 'Sign in'} · APS Skills Hub</title></svelte:head>
<section class="auth-page">
	<div class="eyebrow">APS Skills Hub</div>
	<h1>{register ? 'Make your expertise useful.' : 'Welcome back.'}</h1>
	<p>
		{register
			? 'Create an account to publish and maintain your own skills.'
			: 'Sign in to publish skills and manage your contributions.'}
	</p>
	<form
		class="form-card"
		method="POST"
		use:enhance={() => {
			pending = true;
			return async ({ update }) => {
				await update({ reset: false });
				pending = false;
			};
		}}
	>
		{#if form?.message}<div class="notice error" role="alert">{form.message}</div>{/if}
		<div class="field">
			<label for="username">Username</label><input
				id="username"
				name="username"
				bind:value={username}
				autocomplete="username"
				required
				minlength="3"
				maxlength="32"
				pattern={'[a-zA-Z][a-zA-Z0-9_\\-]{2,31}'}
			/>{#if register}<small>3–32 letters, numbers, hyphens or underscores.</small>{/if}
		</div>
		{#if register}<div class="field">
				<label for="displayName">Display name <span class="muted">(optional)</span></label><input
					id="displayName"
					name="displayName"
					bind:value={displayName}
					autocomplete="name"
					maxlength="80"
				/>
			</div>{/if}
		<div class="field">
			<label for="password">Password</label><input
				id="password"
				name="password"
				bind:value={password}
				type="password"
				autocomplete={register ? 'new-password' : 'current-password'}
				required
				minlength={register ? 12 : 1}
				maxlength="128"
			/>{#if register}<small>At least 12 characters. A passphrase works well.</small>{/if}
		</div>
		<button class="button primary" disabled={pending}
			>{pending ? 'Please wait…' : register ? 'Create account' : 'Sign in'}<ArrowRight
				size={16}
			/></button
		>
		{#if !register}<p class="small-text muted" style="margin: 18px 0 0">
				Forgot your password? Contact your hub administrator for a reset.
			</p>{/if}
	</form>
	<p class="auth-switch">
		{register ? 'Already have an account?' : 'New to the hub?'}
		<a href={`${base}/${register ? 'sign-in' : 'register'}`}
			>{register ? 'Sign in' : 'Create an account'}</a
		>
	</p>
</section>
