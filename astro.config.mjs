// @ts-check
import { defineConfig } from 'astro/config';

// https://astro.build/config
// BASE_PATH is set by the pull request preview build, which is served from /pr-preview/pr-<n>/.
export default defineConfig({
	site: 'https://a11ign.github.io',
	base: process.env.BASE_PATH ?? '/',
});
