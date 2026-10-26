import { readFileSync } from 'node:fs';

/** Every page, and the JSON-LD @types it must carry. The 404 is reached through an address that does not exist. */
export const PAGES = [
	{ path: '/', ld: ['SoftwareApplication'] },
	{ path: '/get-started', ld: [] },
	{ path: '/what-it-checks', ld: [] },
	{ path: '/docs', ld: ['Article', 'BreadcrumbList'] },
	{ path: '/docs/github-action', ld: ['Article', 'BreadcrumbList'] },
	{ path: '/docs/how-we-know-it-works', ld: ['Article', 'BreadcrumbList'] },
	{ path: '/docs/security', ld: ['Article', 'BreadcrumbList'] },
	{ path: '/docs/contributing', ld: ['Article', 'BreadcrumbList'] },
	// Resources is hidden at launch: noindex, and not in the sitemap, until the site has enough posts (src/data/resources.ts).
	{ path: '/resources', ld: [], hidden: true },
	{ path: '/about', ld: [] },
	{ path: '/faq', ld: ['FAQPage'] },
	{ path: '/contact', ld: [] },
	{ path: '/privacy', ld: [] },
	{ path: '/cookies', ld: [] },
	{ path: '/terms', ld: [] },
	{ path: '/accessibility', ld: [] },
	{ path: '/pricing', ld: [], notFound: true },
] as const;

export const CONTENT_PAGES = PAGES.filter((page) => !('notFound' in page));

/** The pages the sitemap lists while Resources is off. */
export const SITEMAP_PAGES = CONTENT_PAGES.filter((page) => !('hidden' in page));

/** The title and description Resources keeps with its page, because the a11ign-seo pack has no row for it. */
export const RESOURCES_SEO = { title: 'Resources', description: 'How-tos, guides and articles for testing with a real screen reader.' };

const readme = readFileSync(new URL('../src/data/seo/README.md', import.meta.url), 'utf8');

/** The a11ign-seo pack's title and description for a page, read straight from its README table. */
export function seoFor(path: string) {
	if (path === '/resources') return RESOURCES_SEO;
	const row = readme.split('\n').find((line) => line.startsWith(`| \`${path}\` |`));
	if (!row) throw new Error(`No SEO row for ${path}`);
	const [, , title, description] = row.split('|').map((cell) => cell.trim());
	return { title, description };
}
