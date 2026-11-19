import adapter from '@sveltejs/adapter-node';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [
		sveltekit({
			preprocess: vitePreprocess(),
			adapter: adapter(),
			// SvelteKit's built-in CSRF guard rejects cross-origin form-encoded POSTs,
			// which would block /oauth/token: RFC 6749 requires that encoding and real
			// OAuth clients are not browsers, so they send no Origin header at all.
			// hooks.server.ts performs the same origin comparison for every unsafe
			// method — a wider net than this check — and names the three endpoints
			// that are deliberately exempt, so it is the single place that decides.
			csrf: { trustedOrigins: ['*'] },
			paths: {
				base: (process.env.BASE_PATH || '') as '' | `/${string}`,
				// Keep `resolve()` absolute during SSR. The app uses it for cookie `path`
				// attributes and `Location` headers, which must not be relative.
				relative: false
			}
		})
	]
});
