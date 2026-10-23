<script lang="ts">
	import { page } from '$app/state';
	import { base } from '$app/paths';
</script>

<svelte:head><title>{page.status} · APS Skills Hub</title></svelte:head>
<div class="shell" style="padding-top: 60px">
	<div class="empty">
		<span class="eyebrow" style="justify-content:center">{page.status}</span>
		<h1>{page.status === 404 ? 'Page not found' : 'Unable to complete this request'}</h1>
		<p>{page.error?.message}</p>
		<a class="button" href={`${base}/`}>Explore skills</a>
	</div>
</div>
