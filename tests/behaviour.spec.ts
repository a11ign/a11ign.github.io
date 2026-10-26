import { expect, test, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { CONTENT_PAGES, SITEMAP_PAGES } from './pages';

const GITHUB = 'https://github.com/a11ign/a11ign';
const read = (name: string) => readFileSync(new URL(`../src/data/seo/${name}`, import.meta.url), 'utf8');

test.describe('theme', () => {
	test('a first-time visitor gets their system theme', async ({ browser }) => {
		for (const scheme of ['light', 'dark'] as const) {
			const context = await browser.newContext({ colorScheme: scheme });
			const page = await context.newPage();
			await page.goto('/');
			const ground = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
			expect(ground).toBe(scheme === 'light' ? 'rgb(255, 255, 255)' : 'rgb(18, 13, 28)');
			await context.close();
		}
	});

	test('the toggle switches at once, relabels, and the choice survives a page change and a reload with no flash', async ({ browser }) => {
		const context = await browser.newContext({ colorScheme: 'dark' });
		const page = await context.newPage();
		await page.goto('/');
		const toggle = page.getByRole('button', { name: 'Switch to light theme' });
		await toggle.click();
		await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
		await expect(page.getByRole('button', { name: 'Switch to dark theme' })).toBeVisible();
		expect(await page.evaluate(() => getComputedStyle(document.body).backgroundColor)).toBe('rgb(255, 255, 255)');

		await page.getByRole('navigation', { name: 'Main', exact: true }).getByRole('link', { name: 'Docs' }).click();
		await expect(page).toHaveURL(/\/docs$/);
		await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');

		// The saved choice is applied while the head is parsed, before the body exists, so there is no flash of dark.
		const fresh = await context.newPage();
		await fresh.addInitScript(() => {
			new MutationObserver((_, observer) => {
				if (document.body) {
					(window as unknown as { themeAtBody: string | null }).themeAtBody = document.documentElement.getAttribute('data-theme');
					observer.disconnect();
				}
			}).observe(document, { childList: true, subtree: true });
		});
		await fresh.goto('/about');
		expect(await fresh.evaluate(() => (window as unknown as { themeAtBody: string | null }).themeAtBody)).toBe('light');
		expect(await context.cookies()).toEqual([]);
		await context.close();
	});

	test('a blocked localStorage falls back to the system theme without errors', async ({ browser }) => {
		const context = await browser.newContext({ colorScheme: 'light' });
		await context.addInitScript(() => {
			Object.defineProperty(window, 'localStorage', {
				get() {
					throw new Error('blocked');
				},
			});
		});
		const page = await context.newPage();
		const errors: string[] = [];
		page.on('pageerror', (error) => errors.push(error.message));
		await page.goto('/');
		await page.getByRole('button', { name: 'Switch to dark theme' }).click();
		await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
		expect(errors).toEqual([]);
		await context.close();
	});

	test('without JavaScript the toggle, menu button and Copy buttons are not shown and everything is in the page', async ({ browser }) => {
		const context = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 390, height: 900 } });
		const page = await context.newPage();
		await page.goto('/');
		await expect(page.locator('[data-theme-toggle]')).toBeHidden();
		await expect(page.locator('[data-menu-button]')).toBeHidden();
		await expect(page.locator('[data-copy]').first()).toBeHidden();
		await expect(page.getByRole('navigation', { name: 'Main menu' })).toBeVisible();
		await expect(page.getByText('[Claude Code install command, to be added when the skill is published]')).toBeVisible();
		await expect(page.getByText('[Codex install command, to be added when the skill is published]')).toBeVisible();

		await page.goto('/faq');
		const answers = await page.locator('details').count();
		expect(answers).toBe(28);
		expect(await page.locator('details .ans').first().textContent()).toContain('Not if you use the GitHub Action');
		await context.close();
	});
});

test.describe('mobile menu', () => {
	test.use({ viewport: { width: 390, height: 800 } });

	test('opens, reports its state, and Escape closes it and returns focus to the button', async ({ page }) => {
		await page.goto('/');
		const button = page.getByRole('button', { name: 'Open menu' });
		await expect(button).toHaveAttribute('aria-expanded', 'false');
		await expect(page.locator('#a11ign-menu')).toBeHidden();
		await button.click();
		const close = page.getByRole('button', { name: 'Close menu' });
		await expect(close).toHaveAttribute('aria-expanded', 'true');
		await expect(close).toHaveAttribute('aria-controls', 'a11ign-menu');
		await expect(page.locator('#a11ign-menu')).toBeVisible();
		await page.getByRole('link', { name: 'Docs' }).first().focus();
		await page.keyboard.press('Escape');
		await expect(page.getByRole('button', { name: 'Open menu' })).toBeFocused();
		await expect(page.getByRole('button', { name: 'Open menu' })).toHaveAttribute('aria-expanded', 'false');
		await expect(page.locator('#a11ign-menu')).toBeHidden();
	});
});

test.describe('install tabs', () => {
	test('arrows, Home and End move, select and focus, and the code block follows', async ({ page }) => {
		for (const path of ['/', '/get-started']) {
			await page.goto(path);
			const claude = page.getByRole('tab', { name: 'Claude Code' });
			const codex = page.getByRole('tab', { name: 'Codex' });
			await expect(claude).toHaveAttribute('aria-selected', 'true');
			await expect(claude).toHaveAttribute('tabindex', '0');
			await expect(codex).toHaveAttribute('tabindex', '-1');
			await claude.focus();
			await page.keyboard.press('ArrowRight');
			await expect(codex).toBeFocused();
			await expect(codex).toHaveAttribute('aria-selected', 'true');
			await expect(claude).toHaveAttribute('aria-selected', 'false');
			const panel = page.getByRole('tabpanel');
			await expect(panel.locator('[data-agent-code]:visible')).toHaveCount(1);
			await expect(panel.locator('[data-agent-code]:visible')).toContainText('[Codex install command, to be added when the skill is published]');
			await expect(panel.getByRole('region', { name: 'Codex, scrollable' })).toBeVisible();
			await page.keyboard.press('ArrowLeft');
			await expect(claude).toBeFocused();
			await page.keyboard.press('End');
			await expect(codex).toBeFocused();
			await expect(codex).toHaveAttribute('aria-selected', 'true');
			await page.keyboard.press('Home');
			await expect(claude).toBeFocused();
			await expect(claude).toHaveAttribute('aria-selected', 'true');
			await expect(panel.locator('[data-agent-code]:visible')).toContainText('[Claude Code install command, to be added when the skill is published]');
		}
	});
});

test.describe('install tabs, edge cases', () => {
	test('Alt+Arrow is left to the browser, and without JavaScript there is no tab panel', async ({ page, browser }) => {
		await page.goto('/');
		const claude = page.getByRole('tab', { name: 'Claude Code' });
		await claude.focus();
		await page.keyboard.press('Alt+ArrowRight');
		await expect(claude).toHaveAttribute('aria-selected', 'true');
		await expect(page.getByRole('tabpanel')).toHaveAttribute('aria-labelledby', 'ag-t-claude');

		const plain = await browser.newContext({ javaScriptEnabled: false });
		const noJs = await plain.newPage();
		await noJs.goto('/');
		await expect(noJs.getByRole('tabpanel')).toHaveCount(0);
		await plain.close();
	});
});

test.describe('copy buttons', () => {
	test('success: reads Copied for 2 seconds with a polite status', async ({ browser }) => {
		const context = await browser.newContext({ permissions: ['clipboard-read', 'clipboard-write'] });
		const page = await context.newPage();
		await page.goto('/docs/github-action');
		const block = page.locator('.a1-code').first();
		await block.getByRole('button', { name: 'Copy' }).click();
		await expect(block.getByRole('button', { name: 'Copied' })).toBeVisible();
		await expect(block.getByRole('status')).toHaveText('Copied to clipboard');
		expect(await page.evaluate(() => navigator.clipboard.readText())).toContain('runs-on: windows-2022');
		await expect(block.getByRole('button', { name: 'Copy' })).toBeVisible({ timeout: 3500 });
		await expect(block.getByRole('status')).toHaveText('');
		await context.close();
	});

	test('the status only says Copied once the clipboard write has resolved', async ({ page }) => {
		await page.addInitScript(() => {
			Object.defineProperty(navigator, 'clipboard', {
				value: { writeText: () => new Promise((resolve) => ((window as unknown as { finish: () => void }).finish = () => resolve(undefined))) },
			});
		});
		await page.goto('/docs/github-action');
		const block = page.locator('.a1-code').first();
		await block.getByRole('button', { name: 'Copy' }).click();
		await expect(block.getByRole('status')).toHaveText('');
		await expect(block.getByRole('button', { name: 'Copy' })).toBeVisible();
		await page.evaluate(() => (window as unknown as { finish: () => void }).finish());
		await expect(block.getByRole('status')).toHaveText('Copied to clipboard');
	});

	test('failure: stays Copy, selects the code and says so', async ({ page }) => {
		await page.addInitScript(() => {
			Object.defineProperty(navigator, 'clipboard', { value: { writeText: () => Promise.reject(new Error('blocked')) } });
		});
		await page.goto('/docs/github-action');
		const block = page.locator('.a1-code').first();
		await block.getByRole('button', { name: 'Copy' }).click();
		await expect(block.getByRole('status')).toHaveText("Couldn't copy. The text is selected, so you can copy it yourself.");
		await expect(block.getByRole('button', { name: 'Copy' })).toBeVisible();
		const selected = await page.evaluate(() => window.getSelection()?.toString());
		expect(selected).toContain('runs-on: windows-2022');
	});

	test('a second failure is announced again', async ({ page }) => {
		await page.addInitScript(() => {
			Object.defineProperty(navigator, 'clipboard', { value: { writeText: () => Promise.reject(new Error('blocked')) } });
		});
		await page.goto('/docs/github-action');
		const block = page.locator('.a1-code').first();
		await block.evaluate((el) => {
			const status = el.querySelector('[data-copy-status]')!;
			(window as unknown as { spoken: string[] }).spoken = [];
			new MutationObserver(() => {
				if (status.textContent) (window as unknown as { spoken: string[] }).spoken.push(status.textContent);
			}).observe(status, { childList: true, characterData: true, subtree: true });
		});
		const copy = block.getByRole('button', { name: 'Copy' });
		await copy.click();
		await expect(block.getByRole('status')).toHaveText(/Couldn't copy/);
		await copy.click();
		await expect.poll(() => page.evaluate(() => (window as unknown as { spoken: string[] }).spoken.length)).toBe(2);
	});

	test('no Download button anywhere', async ({ page }) => {
		for (const { path } of CONTENT_PAGES) {
			await page.goto(path);
			await expect(page.getByRole('button', { name: /download/i })).toHaveCount(0);
		}
	});
});

test.describe('keyboard', () => {
	test('Tab first shows the skip link, which goes to #main', async ({ page }) => {
		await page.goto('/about');
		await page.keyboard.press('Tab');
		const skip = page.getByRole('link', { name: 'Skip to main content' });
		await expect(skip).toBeFocused();
		expect((await skip.boundingBox())?.y).toBeGreaterThanOrEqual(0);
		await page.keyboard.press('Enter');
		await expect(page).toHaveURL(/#main$/);
	});

	for (const { path } of CONTENT_PAGES) {
		test(`${path}: every control shows a 3px focus ring and is at least 44px by 44px`, async ({ page }) => {
			await page.setViewportSize({ width: 1440, height: 900 });
			await page.goto(path);
			const seen = new Set<string>();
			const problems: string[] = [];
			for (let i = 0; i < 120; i++) {
				await page.keyboard.press('Tab');
				const info = await page.evaluate(() => {
					const el = document.activeElement as HTMLElement | null;
					if (!el || el === document.body) return null;
					const visited = el.dataset.focusVisited === 'yes';
					el.dataset.focusVisited = 'yes';
					const ringOn = (node: Element) => {
						const cs = getComputedStyle(node);
						return cs.outlineStyle === 'solid' && parseFloat(cs.outlineWidth) >= 3;
					};
					const ring = ringOn(el) || (el.closest('.rc') ? ringOn(el.closest('.rc')!) : false);
					const rect = el.getBoundingClientRect();
					// A link inside a sentence is not a standalone control.
					const parent = el.parentElement;
					const inCard = Boolean(el.closest('.rc')); // the whole card is the link's hit area
					const inText = inCard || el.tagName === 'A' && ['inline', 'inline-flex'].includes(getComputedStyle(el).display) && parent && (parent.textContent ?? '').trim() !== (el.textContent ?? '').trim();
					return { visited, id: `${el.tagName} ${(el.textContent ?? '').trim().slice(0, 30)} ${el.getAttribute('href') ?? ''}`, ring, w: rect.width, h: rect.height, inText: Boolean(inText) };
				});
				if (!info) continue;
				if (info.visited) break;
				seen.add(info.id);
				if (!info.ring) problems.push(`${info.id}: no 3px focus ring`);
				if (!info.inText && (info.w < 43.5 || info.h < 43.5)) problems.push(`${info.id}: ${Math.round(info.w)}x${Math.round(info.h)}`);
			}
			expect(problems).toEqual([]);
			expect(seen.size).toBeGreaterThan(3);
		});
	}
});

test.describe('GitHub, privacy and fonts', () => {
	async function externalRequests(page: Page, paths: string[]) {
		const hosts = new Set<string>();
		page.on('request', (request) => hosts.add(new URL(request.url()).host));
		for (const path of paths) await page.goto(path);
		return [...hosts].filter((host) => !host.startsWith('127.0.0.1'));
	}

	test('every page loads fonts from the site, makes no outside request, sets no cookie and no analytics', async ({ page, context }) => {
		const outside = await externalRequests(page, CONTENT_PAGES.map((p) => p.path));
		expect(outside).toEqual([]);
		expect(await context.cookies()).toEqual([]);
		expect(await page.evaluate(() => document.cookie)).toBe('');
		await page.goto('/');
		const fonts = await page.evaluate(() => [...document.fonts].filter((f) => f.status === 'loaded').map((f) => f.family));
		expect(new Set(fonts)).toEqual(new Set(['Bricolage Grotesque', 'Lexend', 'Atkinson Hyperlegible Mono']));
	});

	test('the GitHub links, StarPill and Star buttons go to the repository, with no count', async ({ page }) => {
		await page.goto('/');
		for (const link of await page.getByRole('link', { name: /^GitHub$/ }).all()) await expect(link).toHaveAttribute('href', GITHUB);
		const star = page.getByRole('link', { name: 'Star on GitHub', exact: true });
		for (const link of await star.all()) await expect(link).toHaveAttribute('href', GITHUB);
		await expect(page.locator('.a1-star')).toHaveText('Star');
		await expect(page.locator('.a1-star-count')).toHaveCount(0);
		await page.goto('/docs/how-we-know-it-works');
		await expect(page.getByRole('link', { name: 'Star on GitHub', exact: true }).last()).toHaveAttribute('href', GITHUB);
	});

	test('the logos are the outlined artwork, and the footer logo says how to say it', async ({ page }) => {
		await page.goto('/');
		await expect(page.getByRole('link', { name: 'a11ign, home' })).toBeVisible();
		await expect(page.locator('footer img[alt="a11ign, pronounced align"]:visible')).toHaveCount(1);
		expect(await page.locator('.a1-logo').count()).toBe(0);
	});
});

test.describe('content the design marks as unfinished ships as designed', () => {
	test('Privacy and Cookies keep their lines about counting visits', async ({ page }) => {
		await page.goto('/privacy');
		await expect(page.getByText('We count visits to see which pages people read. We use a tool that doesn’t use cookies and doesn’t identify you.')).toBeVisible();
		await page.goto('/cookies');
		await expect(page.getByRole('cell', { name: 'None. We count visits with a tool that doesn’t use cookies.' })).toBeVisible();
	});

	test('placeholders stay visible', async ({ page }) => {
		await page.goto('/contact');
		for (const text of ['X [handle]', 'LinkedIn [page]', 'Reddit [community]', 'YouTube [channel]']) {
			await expect(page.getByRole('link', { name: text })).toHaveAttribute('href', '#');
		}
		await page.goto('/resources');
		await expect(page.getByText('[Placeholder: two sentences on what this guide covers and who it’s for.]')).toBeVisible();
		await expect(page.getByText('[Author] · [Date] · [Read time]')).toBeVisible();
		await page.goto('/');
		await expect(page.getByRole('contentinfo').getByRole('link', { name: 'LinkedIn' })).toHaveAttribute('href', '#');
	});

	test('the 404 page follows the design', async ({ page }) => {
		const response = await page.goto('/pricing');
		expect(response?.status()).toBe(404);
		await expect(page.getByRole('heading', { level: 1 })).toHaveText('We can’t find that page');
		await expect(page.getByText('It may have moved, or the link might be wrong. Here’s where to go next.')).toBeVisible();
		await expect(page.getByRole('link', { name: 'Go to the home page' })).toBeVisible();
		await expect(page.getByRole('link', { name: 'Read the docs' })).toBeVisible();
		await expect(page.getByRole('link', { name: 'Contact and support' }).first()).toBeVisible();
	});
});

test.describe('search and AI files', () => {
	test('robots.txt and llms.txt match the a11ign-seo files exactly', async ({ request }) => {
		expect(await (await request.get('/robots.txt')).text()).toBe(read('robots.txt'));
		expect(await (await request.get('/llms.txt')).text()).toBe(read('llms.txt'));
	});

	test('the sitemap lists the 15 pages with the build date, and neither the 404 nor Resources', async ({ request }) => {
		const xml = await (await request.get('/sitemap.xml')).text();
		const urls = [...xml.matchAll(/<loc>([^<]+)<\/loc><lastmod>([^<]+)<\/lastmod>/g)];
		expect(urls.map((m) => m[1])).toEqual(SITEMAP_PAGES.map((p) => `https://www.a11ign.com${p.path === '/' ? '/' : p.path}`));
		const today = new Date().toISOString().slice(0, 10);
		for (const [, , lastmod] of urls) expect(lastmod).toBe(today);
		expect(xml).not.toContain('[YYYY-MM-DD]');
		expect(xml).not.toContain('404');
		expect(xml).not.toContain('/resources');
	});
});

test.describe('JSON-LD', () => {
	const ld = async (page: Page) => page.$$eval('script[type="application/ld+json"]', (els) => els.map((el) => JSON.parse(el.textContent ?? '')));

	test('Home: a free AGPL SoftwareApplication by Daniel Beck, and no Organization anywhere', async ({ page }) => {
		await page.goto('/');
		const [app] = await ld(page);
		expect(app).toMatchObject({
			'@type': 'SoftwareApplication',
			name: 'a11ign',
			applicationCategory: 'DeveloperApplication',
			operatingSystem: 'Windows',
			offers: { price: '0' },
			license: 'https://spdx.org/licenses/AGPL-3.0-or-later.html',
			author: { '@type': 'Person', name: 'Daniel Beck', url: 'https://danielbeck.dev/' },
		});
		for (const { path } of CONTENT_PAGES) {
			await page.goto(path);
			expect(JSON.stringify(await ld(page))).not.toContain('Organization');
		}
	});

	test('FAQ: every question and answer, word for word', async ({ page }) => {
		await page.goto('/faq');
		const [faq] = await ld(page);
		const onPage = await page.$$eval('details', (els) => els.map((el) => ({ q: el.querySelector('summary')!.textContent, a: el.querySelector('.ans')!.textContent })));
		expect(faq.mainEntity.map((e: { name: string; acceptedAnswer: { text: string } }) => ({ q: e.name, a: e.acceptedAnswer.text }))).toEqual(onPage);
		expect(onPage).toHaveLength(28);
	});

	test('docs pages: an Article dated 2026-10-24 and a breadcrumb starting Home, Documentation', async ({ page }) => {
		for (const path of ['/docs', '/docs/github-action', '/docs/how-we-know-it-works', '/docs/security', '/docs/contributing']) {
			await page.goto(path);
			const blocks = await ld(page);
			const article = blocks.find((b) => b['@type'] === 'Article');
			const crumbs = blocks.find((b) => b['@type'] === 'BreadcrumbList');
			expect(article.datePublished).toBe('2026-10-24');
			expect(article.dateModified).toBe('2026-10-24');
			expect(article.headline).toBe(await page.getByRole('heading', { level: 1 }).textContent());
			const names = crumbs.itemListElement.map((i: { name: string }) => i.name);
			expect(names.slice(0, 2)).toEqual(['Home', 'Documentation']);
			expect(names).toHaveLength(path === '/docs' ? 2 : 3);
		}
	});
});
