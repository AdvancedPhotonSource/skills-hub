import adapter from '@sveltejs/adapter-node';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [
		sveltekit({
			preprocess: vitePreprocess(),
			adapter: adapter(),
			paths: {
				base: (process.env.BASE_PATH || '') as '' | `/${string}`,
				// Keep `resolve()` absolute during SSR. The app uses it for cookie `path`
				// attributes and `Location` headers, which must not be relative.
				relative: false
			}
		})
	]
});
