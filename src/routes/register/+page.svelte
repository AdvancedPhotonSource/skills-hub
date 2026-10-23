<script lang="ts">
	import AuthForm from '$lib/components/AuthForm.svelte';
	let { form } = $props();
</script>

<AuthForm register {form} />
