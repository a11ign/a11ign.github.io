import { readFileSync } from 'node:fs';
import realPosts from './resources-posts.json';

export interface ResourcePost {
	kind: 'How-to' | 'Guide' | 'Article' | 'Worked example';
	title: string;
	desc: string;
	href: string;
	/** "Date · Read time", as shown under the post. */
	byline: string;
}

/** Resources goes live, everywhere at once, when the site has this many real posts. */
export const RESOURCES_MIN_POSTS = 3;

// The real posts live in resources-posts.json. RESOURCES_POSTS_FILE points a build at another list, which is how
// the test builds a site with three posts without adding any.
const file = process.env.RESOURCES_POSTS_FILE;
export const resourcePosts: ResourcePost[] = file ? JSON.parse(readFileSync(file, 'utf8')) : (realPosts as ResourcePost[]);

/**
 * The one switch. It turns on the nav link, the footer link, the sitemap entry, the llms.txt line, indexing,
 * and the filter chips with the "All resources" section. scripts/check-build.mjs fails if any of them disagree.
 */
export const resourcesLive = resourcePosts.length >= RESOURCES_MIN_POSTS;
