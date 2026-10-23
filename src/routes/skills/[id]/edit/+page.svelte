<script lang="ts">
	import SkillEditor from '$lib/components/SkillEditor.svelte';
	let { data, form } = $props();
</script>

<SkillEditor skill={data.skill} {form} />
