import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { PAGES, seoFor } from './pages';

const WIDTHS = [390, 1440];
const SCHEMES = ['light', 'dark'] as const;
const CANONICAL_HOST = 'https://www.a11ign.com';

async function headings(page: Page) {
	return page.$$eval('h1, h2, h3, h4, h5, h6', (els) => els.map((el) => Number(el.tagName[1])));
}

for (const entry of PAGES) {
	for (const width of WIDTHS) {
		for (const scheme of SCHEMES) {
			test.describe(`${entry.path} · ${width} · ${scheme}`, () => {
				test.use({ viewport: { width, height: 900 }, colorScheme: scheme });

				test('passes the checks', async ({ page, request }) => {
					const response = await page.goto(entry.path);
					expect(response?.status()).toBe('notFound' in entry ? 404 : 200);

					// axe-core against WCAG 2.2 AA
					const axe = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze();
					expect(axe.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(' | ')}`)).toEqual([]);

					// one h1, and no skipped heading level
					const levels = await headings(page);
					expect(levels.filter((level) => level === 1)).toHaveLength(1);
					levels.forEach((level, i) => {
						if (i > 0) expect(level, `h${level} follows h${levels[i - 1]}`).toBeLessThanOrEqual(levels[i - 1] + 1);
					});

					// the page never scrolls sideways
					const { scrollWidth, clientWidth } = await page.evaluate(() => ({
						scrollWidth: document.documentElement.scrollWidth,
						clientWidth: document.documentElement.clientWidth,
					}));
					expect(scrollWidth).toBeLessThanOrEqual(clientWidth);

					// every image has an alt attribute
					expect(await page.$$eval('img', (imgs) => imgs.filter((img) => !img.hasAttribute('alt')).length)).toBe(0);

					// every internal link and asset resolves
					const targets = await page.$$eval('a[href], img[src], link[href][rel~="stylesheet"], link[rel~="icon"]', (els) =>
						els.map((el) => (el as HTMLAnchorElement).href || (el as HTMLImageElement).src).filter((url) => url.startsWith(location.origin)),
					);
					const own = page.url().split('#')[0];
					for (const url of new Set(targets.map((t) => t.split('#')[0]).filter((t) => t !== own || !('notFound' in entry)))) {
						expect((await request.get(url)).status(), url).toBe(200);
					}

					// title, description, canonical, social tags
					const meta = (name: string) =>
						page.evaluate((n) => document.querySelector(`meta[name="${n}"], meta[property="${n}"]`)?.getAttribute('content') ?? null, name);
					if ('notFound' in entry) {
						await expect(page).toHaveTitle('Page not found');
						expect(await meta('robots')).toBe('noindex');
					} else {
						const seo = seoFor(entry.path);
						await expect(page).toHaveTitle(seo.title);
						expect(await meta('description')).toBe(seo.description);
						expect(await page.locator('link[rel="canonical"]').getAttribute('href')).toBe(`${CANONICAL_HOST}${entry.path}`);
						expect(await meta('og:url')).toBe(`${CANONICAL_HOST}${entry.path}`);
						expect(await meta('robots')).toBeNull();
					}
					expect(await meta('og:image')).toBe(`${CANONICAL_HOST}/a11ign-share-card.png`);
					expect(await meta('twitter:card')).toBe('summary_large_image');
					expect(await meta('og:title')).toBe(await page.title());

					// JSON-LD parses and carries the agreed types
					const blocks = await page.$$eval('script[type="application/ld+json"]', (els) => els.map((el) => JSON.parse(el.textContent ?? '')));
					expect(blocks.map((block) => block['@type']).sort()).toEqual([...entry.ld].sort());
				});
			});
		}
	}
}
