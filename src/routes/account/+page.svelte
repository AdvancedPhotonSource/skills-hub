<script lang="ts">
	import { base } from '$app/paths';
	import { enhance } from '$app/forms';
	let { data, form } = $props();
</script>

<svelte:head><title>Account · APS Skills Hub</title></svelte:head>
<section class="auth-page">
	<h1>Your account</h1>
	<p>{data.account.displayName} <span class="badge">{data.account.username}</span></p>
	<form method="POST" class="form-card" use:enhance>
		{#if form?.message}<div class="notice error" role="alert">
				{form.message}
			</div>{/if}{#if form?.success}<div class="notice success" role="status">
				Password changed. Other sessions have been signed out.
			</div>{/if}
		<h2>Change password</h2>
		<div class="field">
			<label for="currentPassword">Current password</label><input
				id="currentPassword"
				name="currentPassword"
				type="password"
				autocomplete="current-password"
				required
				maxlength="128"
			/>
		</div>
		<div class="field">
			<label for="password">New password</label><input
				id="password"
				name="password"
				type="password"
				autocomplete="new-password"
				required
				minlength="12"
				maxlength="128"
			/><small>Use 12–128 characters.</small>
		</div>
		<button class="button primary">Change password</button>
	</form>
	<form method="POST" action={`${base}/sign-out`} style="margin-top: 24px">
		<button class="button">Sign out</button>
	</form>
</section>
