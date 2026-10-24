import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { PAGES, seoFor } from './pages';

const WIDTHS = [390, 1440];
const SCHEMES = ['light', 'dark'] as const;
const CANONICAL_HOST = 'https://www.a11ign.com';

const metaContent = (page: Page, name: string) =>
	page.evaluate((n) => document.querySelector(`meta[name="${n}"], meta[property="${n}"]`)?.getAttribute('content') ?? null, name);

// Every page, at both widths, in both colour schemes: 17 pages x 2 x 2 = 68 views.
for (const entry of PAGES) {
	const isNotFound = 'notFound' in entry;
	for (const width of WIDTHS) {
		for (const scheme of SCHEMES) {
			test.describe(`${entry.path} · ${width} · ${scheme}`, () => {
				test.use({ viewport: { width, height: 900 }, colorScheme: scheme });
				test.beforeEach(async ({ page }) => {
					const response = await page.goto(entry.path);
					expect(response?.status()).toBe(isNotFound ? 404 : 200);
				});

				test('has no axe-core violations against WCAG 2.2 AA', async ({ page }) => {
					const axe = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze();
					expect(axe.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(' | ')}`)).toEqual([]);
				});

				test('has one h1, no skipped heading level, no sideways scroll and alt text on every image', async ({ page }) => {
					const levels = await page.$$eval('h1, h2, h3, h4, h5, h6', (els) => els.map((el) => Number(el.tagName[1])));
					expect(levels.filter((level) => level === 1)).toHaveLength(1);
					levels.forEach((level, i) => {
						if (i > 0) expect(level, `h${level} follows h${levels[i - 1]}`).toBeLessThanOrEqual(levels[i - 1] + 1);
					});
					const { scrollWidth, clientWidth } = await page.evaluate(() => ({
						scrollWidth: document.documentElement.scrollWidth,
						clientWidth: document.documentElement.clientWidth,
					}));
					expect(scrollWidth).toBeLessThanOrEqual(clientWidth);
					expect(await page.$$eval('img', (imgs) => imgs.filter((img) => !img.hasAttribute('alt')).length)).toBe(0);
				});

				test('links to pages and assets that exist', async ({ page, request }) => {
					const own = page.url().split('#')[0];
					const targets = await page.$$eval('a[href], img[src], link[href][rel~="stylesheet"], link[rel~="icon"]', (els) =>
						els.map((el) => (el as HTMLAnchorElement).href || (el as HTMLImageElement).src).filter((url) => url.startsWith(location.origin)),
					);
					// The 404 page's own address, reached by its skip link, is the one address that answers 404.
					const urls = new Set(targets.map((t) => t.split('#')[0]).filter((t) => !(isNotFound && t === own)));
					for (const url of urls) expect((await request.get(url)).status(), url).toBe(200);
				});

				test('has the title, description, canonical and share tags it should', async ({ page }) => {
					if (isNotFound) {
						await expect(page).toHaveTitle('Page not found');
						expect(await metaContent(page, 'robots')).toBe('noindex');
					} else {
						const seo = seoFor(entry.path);
						await expect(page).toHaveTitle(seo.title);
						expect(await metaContent(page, 'description')).toBe(seo.description);
						expect(await page.locator('link[rel="canonical"]').getAttribute('href')).toBe(`${CANONICAL_HOST}${entry.path}`);
						expect(await metaContent(page, 'og:url')).toBe(`${CANONICAL_HOST}${entry.path}`);
						expect(await metaContent(page, 'robots')).toBeNull();
					}
					expect(await metaContent(page, 'og:image')).toBe(`${CANONICAL_HOST}/a11ign-share-card.png`);
					expect(await metaContent(page, 'twitter:card')).toBe('summary_large_image');
					expect(await metaContent(page, 'og:title')).toBe(await page.title());
				});

				test('carries JSON-LD that parses and has the agreed types', async ({ page }) => {
					const blocks = await page.$$eval('script[type="application/ld+json"]', (els) => els.map((el) => JSON.parse(el.textContent ?? '')));
					expect(blocks.map((block) => block['@type']).sort()).toEqual([...entry.ld].sort());
				});
			});
		}
	}
}
