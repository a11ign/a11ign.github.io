// @ts-check
import { defineConfig } from 'astro/config';

// https://astro.build/config
// BASE_PATH is set by the pull request preview build, which is served from /pr-preview/pr-<n>/.
// `site` is the live domain: canonical URLs, Open Graph URLs and the sitemap always use it, never the base.
export default defineConfig({
	site: 'https://www.a11ign.com',
	base: process.env.BASE_PATH ?? '/',
	trailingSlash: 'never',
	// "assets", not Astro's default "_astro": GitHub Pages' Jekyll skips folders that start with an underscore
	// unless the gh-pages root has a .nojekyll, which a pull request preview does not control.
	build: { format: 'file', assets: 'assets' },
});
