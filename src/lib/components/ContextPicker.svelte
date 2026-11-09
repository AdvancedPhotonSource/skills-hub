<script lang="ts">
	import { untrack } from 'svelte';
	import { ChevronDown } from '@lucide/svelte';
	import { beamlines, facilities, canonicalContext, beamlineDirectoryUrl } from '$lib/contexts';
	let { contexts = ['aps'] }: { contexts?: string[] } = $props();
	let selected = $state(untrack(() => contexts.map((value) => canonicalContext(value) || value)));
	const unknown = $derived(contexts.filter((value) => !canonicalContext(value)));
	let container: HTMLFieldSetElement;
	const groups = [
		{
			id: 'facilities',
			label: 'Facilities',
			placeholder: 'Select facilities',
			options: facilities
		},
		{
			id: 'beamlines',
			label: 'APS beamlines and endstations',
			placeholder: 'Select beamlines / endstations',
			options: beamlines
		}
	];
	function toggle(value: string, checked: boolean) {
		selected = checked
			? [...new Set([...selected, value])]
			: selected.filter((item) => item !== value);
	}
	function closeDropdowns() {
		container
			?.querySelectorAll('details[open]')
			.forEach((details) => details.removeAttribute('open'));
	}
</script>

<svelte:window
	onclick={(event) => {
		if (event.target instanceof Node && !container?.contains(event.target)) closeDropdowns();
	}}
	onkeydown={(event) => {
		if (event.key === 'Escape' && container?.contains(document.activeElement)) {
			const summary = container
				.querySelector<HTMLDetailsElement>('details[open]')
				?.querySelector('summary');
			closeDropdowns();
			summary?.focus();
		}
	}}
/>

<fieldset class="field" bind:this={container} aria-describedby="contexts-help">
	<legend>Facility / beamline / endstation</legend>
	<div class="context-dropdowns">
		{#each groups as group}
			{@const chosen = group.options
				.filter(([value]) => selected.includes(value))
				.map(([, label]) => label)}
			<div class="context-control">
				<span class="control-label" id={`${group.id}-label`}>{group.label}</span>
				<details
					class="context-dropdown"
					ontoggle={(event) => {
						if (event.currentTarget.open) {
							container.querySelectorAll('details[open]').forEach((other) => {
								if (other !== event.currentTarget) other.removeAttribute('open');
							});
						}
					}}
				>
					<summary aria-labelledby={`${group.id}-label ${group.id}-selection`}>
						<span
							id={`${group.id}-selection`}
							class:placeholder={!chosen.length}
							title={chosen.join(', ')}
						>
							{chosen.length
								? chosen.length <= 2
									? chosen.join(', ')
									: `${chosen.length} selected`
								: group.placeholder}
						</span>
						<ChevronDown size={15} aria-hidden="true" />
					</summary>
					<div class="dropdown-options" role="group" aria-labelledby={`${group.id}-label`}>
						{#each group.options as [value, label]}
							<label
								><input
									type="checkbox"
									name="contexts"
									{value}
									checked={selected.includes(value)}
									onchange={(event) => toggle(value, event.currentTarget.checked)}
								/>{label}</label
							>
						{/each}
					</div>
				</details>
			</div>
		{/each}
	</div>
	{#if unknown.length}
		<div class="previous-contexts">
			<small>Previously saved tags — deselect and choose a replacement:</small>
			{#each unknown as value}<label
					><input
						type="checkbox"
						name="contexts"
						{value}
						checked={selected.includes(value)}
						onchange={(event) => toggle(value, event.currentTarget.checked)}
					/>{value} (unrecognized)</label
				>{/each}
		</div>
	{/if}
	<small id="contexts-help"
		>Select multiple entries in either dropdown, up to 10 total. Names follow the <a
			href={beamlineDirectoryUrl}
			target="_blank"
			rel="noreferrer">APS directory</a
		>.</small
	>
</fieldset>

<style>
	.context-dropdowns {
		display: grid;
		grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
		gap: 14px;
	}
	.control-label {
		display: block;
		margin-bottom: 7px;
		font-size: 12px;
		color: var(--muted);
	}
	.context-dropdown {
		position: relative;
	}
	summary {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 10px;
		padding: 10px 12px;
		border: 1px solid light-dark(#cbd4df, var(--line));
		border-radius: 6px;
		background: var(--paper);
		font-size: 13px;
		cursor: pointer;
		list-style: none;
	}
	summary::-webkit-details-marker {
		display: none;
	}
	summary > span {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	summary :global(svg) {
		flex-shrink: 0;
		color: var(--muted);
	}
	.placeholder {
		color: var(--muted);
	}
	details[open] summary {
		border-color: var(--blue);
	}
	details[open] summary :global(svg) {
		transform: rotate(180deg);
	}
	.dropdown-options {
		position: absolute;
		z-index: 10;
		top: calc(100% + 5px);
		left: 0;
		right: 0;
		max-height: 260px;
		overflow-y: auto;
		padding: 5px;
		border: 1px solid var(--line);
		border-radius: 6px;
		background: var(--paper);
		box-shadow: 0 6px 18px #0002;
	}
	.dropdown-options label,
	.previous-contexts label {
		display: flex;
		align-items: center;
		gap: 9px;
		padding: 8px;
		font-size: 13px;
		cursor: pointer;
	}
	.dropdown-options label:hover {
		background: var(--surface);
	}
	.dropdown-options input,
	.previous-contexts input {
		width: 15px;
		height: 15px;
		margin: 0;
		accent-color: var(--blue);
	}
	.previous-contexts {
		margin-top: 8px;
	}
	small a {
		text-decoration: underline;
	}
	@media (max-width: 600px) {
		.context-dropdowns {
			grid-template-columns: 1fr;
		}
	}
</style>
