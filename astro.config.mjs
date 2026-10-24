// @ts-check
import { defineConfig } from 'astro/config';

// https://astro.build/config
// BASE_PATH is set by the pull request preview build, which is served from /pr-preview/pr-<n>/.
// `site` is the live domain: canonical URLs, Open Graph URLs and the sitemap always use it, never the base.
export default defineConfig({
	site: 'https://www.a11ign.com',
	base: process.env.BASE_PATH ?? '/',
	trailingSlash: 'never',
	build: { format: 'file' },
});
