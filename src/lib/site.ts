import seoReadme from '../data/seo/README.md?raw';

export const SITE_URL = 'https://www.a11ign.com';
export const GITHUB_URL = 'https://github.com/a11ign/a11ign';
export const LINKEDIN_URL = 'https://www.linkedin.com/company/a11ign';
export const SHARE_IMAGE = `${SITE_URL}/a11ign-share-card.png`;
export const SHARE_IMAGE_ALT = 'a11ign: test accessibility the way a screen reader user hears it';
/** The date the docs pages were written, fixed in code rather than taken from the build. */
export const DOCS_DATE = '2026-10-24';

export const AUTHOR = { '@type': 'Person', name: 'Daniel Beck', url: 'https://danielbeck.dev/' } as const;

export interface PageMeta {
	path: string;
	title: string;
	description: string;
}

/** The Resources page keeps its own title and description: the a11ign-seo pack has no row for it while it is hidden. */
export const RESOURCES_META = {
	title: 'Resources',
	description: 'How-tos, guides and articles for testing with a real screen reader.',
} as const;

/** Title and description for every other page, read from the a11ign-seo pack's README table. */
export const pages: Record<string, PageMeta> = Object.fromEntries(
	[...seoReadme.matchAll(/^\| `([^`]+)` \| (.+?) \| (.+?) \|$/gm)].map(([, path, title, description]) => [
		path,
		{ path, title, description },
	]),
);

export function pageMeta(path: string): PageMeta {
	const meta = pages[path];
	if (!meta) throw new Error(`No title and description for ${path} in src/data/seo/README.md`);
	return meta;
}

/** The URL of a page on the live domain, with no base path. */
export function canonical(path: string): string {
	return `${SITE_URL}${path}`;
}

/** An internal URL for a page or asset, under the site's base ("/" or "/pr-preview/pr-<n>/"). */
export function href(path: string): string {
	const base = import.meta.env.BASE_URL.replace(/\/$/, '');
	return `${base}${path.startsWith('/') ? path : `/${path}`}`;
}
