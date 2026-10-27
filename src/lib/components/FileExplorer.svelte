<script lang="ts">
	import {
		Folder,
		FileText,
		FileCode,
		FileJson,
		FileImage,
		File,
		ChevronRight,
		FolderOpen
	} from '@lucide/svelte';
	let {
		files,
		path,
		fileUrl,
		label = 'Skill files'
	}: {
		files: { path: string; size: number }[];
		path: string;
		fileUrl: (path: string) => string;
		label?: string;
	} = $props();
	type Entry = { name: string; path: string; size: number; children?: Entry[] };
	const tree = $derived.by(() => {
		const root: Entry[] = [];
		for (const file of files) {
			const parts = file.path.split('/');
			let entries = root;
			parts.forEach((name, index) => {
				if (index === parts.length - 1) entries.push({ name, path: file.path, size: file.size });
				else {
					let directory = entries.find((entry) => entry.name === name && entry.children);
					if (!directory) {
						directory = { name, path: parts.slice(0, index + 1).join('/'), size: 0, children: [] };
						entries.push(directory);
					}
					entries = directory.children!;
				}
			});
		}
		const sort = (entries: Entry[]) => {
			entries.sort((a, b) =>
				a.name === 'SKILL.md'
					? -1
					: b.name === 'SKILL.md'
						? 1
						: Number(!!b.children) - Number(!!a.children) || a.name.localeCompare(b.name)
			);
			entries.forEach((entry) => {
				if (entry.children) sort(entry.children);
			});
		};
		sort(root);
		return root;
	});
	const size = (bytes: number) => (bytes < 1024 ? `${bytes} B` : `${(bytes / 1024).toFixed(1)} KB`);
	const kind = (name: string) =>
		/\.(py|js|ts|sh|bash)$/i.test(name)
			? 'code'
			: /\.(json|ya?ml|toml)$/i.test(name)
				? 'config'
				: /\.(png|jpe?g|svg|gif|tiff?)$/i.test(name)
					? 'image'
					: /\.(md|txt)$/i.test(name)
						? 'text'
						: 'file';
	const icons = { code: FileCode, config: FileJson, image: FileImage, text: FileText, file: File };
</script>

{#snippet branches(entries: Entry[])}
	<ul>
		{#each entries as entry (entry.path)}<li>
				{#if entry.children}<details class="folder" open>
						<summary
							><ChevronRight size={13} /><Folder size={17} /><span>{entry.name}</span></summary
						>{@render branches(entry.children)}
					</details>{:else}{@const type = kind(entry.name)}{@const Icon = icons[type]}<a
						class:current={entry.path === path}
						href={fileUrl(entry.path)}
						aria-current={entry.path === path ? 'page' : undefined}
						><span class="file-icon" data-kind={type}><Icon size={17} /></span><span
							class="filename">{entry.name}</span
						><span class="file-size">{size(entry.size)}</span></a
					>{/if}
			</li>{/each}
	</ul>
{/snippet}

<details class="explorer" open>
	<summary class="explorer-title"
		><FolderOpen size={17} /><strong>File explorer</strong><span
			>{files.length} {files.length === 1 ? 'file' : 'files'}</span
		><ChevronRight size={15} /></summary
	>
	<nav aria-label={label}>{@render branches(tree)}</nav>
</details>

<style>
	.explorer {
		background: #fafbfd;
		border-bottom: 1px solid var(--line);
	}
	summary {
		cursor: pointer;
		list-style: none;
	}
	summary::-webkit-details-marker {
		display: none;
	}
	.explorer-title {
		display: flex;
		gap: 9px;
		align-items: center;
		padding: 16px 20px;
		color: #50617a;
		font-size: 12px;
	}
	.explorer-title > :global(svg:first-child) {
		color: #a66b0c;
	}
	.explorer-title strong {
		font-weight: 600;
	}
	.explorer-title > span {
		margin-left: auto;
		font:
			11px ui-monospace,
			monospace;
	}
	.explorer[open] > .explorer-title > :global(svg:last-child),
	.folder[open] > summary > :global(svg:first-child) {
		transform: rotate(90deg);
	}
	nav {
		display: block;
		max-height: 300px;
		overflow: auto;
		border-top: 1px solid var(--line);
		padding: 10px 12px;
	}
	ul {
		padding: 0;
		margin: 0;
		list-style: none;
	}
	.folder > ul {
		padding-left: 20px;
		margin-left: 14px;
		border-left: 1px solid #e0e6ee;
	}
	.folder > summary {
		display: flex;
		align-items: center;
		gap: 8px;
		min-height: 35px;
		padding: 5px 9px;
		font-size: 12px;
		color: #47566d;
	}
	.folder > summary > :global(svg:nth-child(2)) {
		color: #b57b0d;
	}
	.folder > summary > :global(svg:first-child) {
		color: #7b8796;
	}
	a {
		display: flex;
		align-items: center;
		gap: 9px;
		min-height: 36px;
		padding: 7px 11px;
		border-radius: 6px;
		font-size: 12px;
		color: #42536d;
	}
	a:hover {
		text-decoration: none;
		background: #eef2f8;
	}
	a.current {
		background: #fff0e5;
		color: #97431b;
		box-shadow: inset 3px 0 #cf7848;
	}
	.filename {
		overflow-wrap: anywhere;
	}
	.file-size {
		margin-left: auto;
		white-space: nowrap;
		color: #56657a;
		font:
			10px ui-monospace,
			monospace;
	}
	.file-icon {
		display: flex;
		color: #67778a;
	}
	.file-icon[data-kind='text'] {
		color: #2a6dcc;
	}
	.file-icon[data-kind='code'] {
		color: #1e8170;
	}
	.file-icon[data-kind='config'] {
		color: #9455ad;
	}
	.file-icon[data-kind='image'] {
		color: #b24b70;
	}
</style>
