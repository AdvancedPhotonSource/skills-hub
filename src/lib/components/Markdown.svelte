<script lang="ts">
	import { loadMathJax } from '$lib/mathjax';
	let { html }: { html: string } = $props();
	let failed = $state(false);

	function typeset(node: HTMLElement) {
		failed = false;
		const elements = Array.from(node.querySelectorAll<HTMLElement>('.math-inline, .math-display'));
		if (!elements.length) return;
		let disposed = false;
		let math: Awaited<ReturnType<typeof loadMathJax>> | undefined;
		void (async () => {
			try {
				math = await loadMathJax();
				if (disposed) return;
				await math.typesetPromise(elements);
				if (disposed) math.typesetClear([node]);
			} catch {
				if (!disposed) failed = true;
			}
		})();
		return {
			destroy() {
				disposed = true;
				math?.typesetClear([node]);
			}
		};
	}
</script>

{#key html}
	<div class="prose" use:typeset>{@html html}</div>
{/key}
{#if failed}<p class="small-text muted" role="status">
		Equations could not be typeset. Showing LaTeX source instead.
	</p>{/if}
