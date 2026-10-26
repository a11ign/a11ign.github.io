import { expect, test } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
// @ts-expect-error: a plain .mjs module shared with scripts/check-build.mjs
import { checkResourcesSwitch, resourcesAreLive, resourcesSignals } from '../scripts/resources-switch.mjs';
// @ts-expect-error: a plain .mjs module
import { serve } from '../scripts/serve.mjs';

test.describe('Resources while it has fewer than 3 real posts', () => {
	test('is in neither the nav nor the footer', async ({ page }) => {
		await page.goto('/');
		await expect(page.getByRole('navigation', { name: 'Main', exact: true }).getByRole('link', { name: 'Resources' })).toHaveCount(0);
		await expect(page.getByRole('navigation', { name: 'Footer' }).getByRole('link', { name: 'Resources' })).toHaveCount(0);
		await page.setViewportSize({ width: 390, height: 800 });
		await expect(page.locator('#a11ign-menu a', { hasText: 'Resources' })).toHaveCount(0);
	});

	test('is in neither the sitemap nor llms.txt', async ({ request }) => {
		expect(await (await request.get('/sitemap.xml')).text()).not.toContain('/resources');
		expect(await (await request.get('/llms.txt')).text()).not.toContain('/resources');
	});

	test('/resources carries noindex and shows only the featured card, linking to /get-started', async ({ page }) => {
		await page.goto('/resources');
		expect(await page.locator('meta[name="robots"]').getAttribute('content')).toBe('noindex');
		await expect(page.getByRole('heading', { level: 1 })).toHaveText('Resources');
		await expect(page.getByRole('heading', { level: 1 }).locator('.a1-hl')).toHaveCount(0);
		const title = page.getByRole('link', { name: 'How to run a11ign on your first page', exact: true });
		await expect(title).toHaveAttribute('href', /\/get-started$/);
		await expect(page.locator('article')).toHaveCount(1);
		await expect(page.locator('[data-chip]')).toHaveCount(0);
		await expect(page.getByRole('heading', { name: 'All resources' })).toHaveCount(0);
		await expect(page.locator('li[data-kind]')).toHaveCount(0);
	});

	test('the six outputs agree in the built site', () => {
		expect(Object.values(resourcesSignals('dist'))).toEqual([false, false, false, false, false, false]);
		expect(resourcesAreLive('dist')).toBe(false);
		expect(checkResourcesSwitch('dist')).toEqual([]);
	});
});

test.describe('Resources in a build with 3 real posts', () => {
	test.describe.configure({ mode: 'serial' });
	let dir = '';
	let server: { close: () => void };
	let origin = '';

	test.beforeAll(async () => {
		dir = mkdtempSync(join(tmpdir(), 'a11ign-fixture-'));
		const out = join(dir, 'dist');
		execFileSync('npx', ['astro', 'build', '--outDir', out], {
			env: { ...process.env, RESOURCES_POSTS_FILE: join(process.cwd(), 'tests/fixtures/resources-3-posts.json') },
			stdio: 'pipe',
		});
		const started = await serve(out);
		server = started.server;
		origin = `http://127.0.0.1:${started.port}`;
	});

	test.afterAll(() => {
		server?.close();
		if (dir) rmSync(dir, { recursive: true, force: true });
	});

	test('the nav link, footer link, sitemap entry, llms.txt line, indexing and the "All resources" section all switch on together', async ({ page, request }) => {
		expect(Object.values(resourcesSignals(join(dir, 'dist')))).toEqual([true, true, true, true, true, true]);
		expect(resourcesAreLive(join(dir, 'dist'))).toBe(true);
		expect(checkResourcesSwitch(join(dir, 'dist'))).toEqual([]);

		await page.goto(`${origin}/`);
		await expect(page.getByRole('navigation', { name: 'Main', exact: true }).getByRole('link', { name: 'Resources' })).toHaveAttribute('href', '/resources');
		await expect(page.getByRole('navigation', { name: 'Footer' }).getByRole('link', { name: 'Resources' })).toHaveAttribute('href', '/resources');
		expect(await (await request.get(`${origin}/sitemap.xml`)).text()).toContain('<loc>https://www.a11ign.com/resources</loc>');
		const llms = await (await request.get(`${origin}/llms.txt`)).text();
		expect(llms).toContain('- [Resources](https://www.a11ign.com/resources): How-tos, guides and articles for testing with a real screen reader.');
		expect((await (await request.get(`${origin}/sitemap.xml`)).text()).match(/<loc>/g)).toHaveLength(16);

		await page.goto(`${origin}/resources`);
		await expect(page.locator('meta[name="robots"]')).toHaveCount(0);
		expect(await page.locator('link[rel="canonical"]').getAttribute('href')).toBe('https://www.a11ign.com/resources');
		await expect(page.getByRole('heading', { name: 'All resources', level: 2 })).toBeVisible();
		await expect(page.getByRole('status')).toHaveText('Showing 3 of 3 resources');
		await expect(page.getByRole('button', { name: 'All', exact: true })).toHaveAttribute('aria-pressed', 'true');
		await expect(page.locator('li[data-kind]')).toHaveCount(3);
	});

	test('a chip shows only its posts, retitles the list and updates the count', async ({ page }) => {
		await page.goto(`${origin}/resources`);
		await page.getByRole('button', { name: 'Guides' }).click();
		await expect(page.getByRole('button', { name: 'Guides' })).toHaveAttribute('aria-pressed', 'true');
		await expect(page.getByRole('heading', { name: 'Guides', level: 2 })).toBeVisible();
		await expect(page.getByRole('status')).toHaveText('Showing 1 of 3 resources');
		await expect(page.locator('li[data-kind]:visible')).toHaveCount(1);
		await page.getByRole('button', { name: 'All', exact: true }).click();
		await expect(page.locator('li[data-kind]:visible')).toHaveCount(3);
	});

	test('without JavaScript the chips are hidden and every post is in the page', async ({ browser }) => {
		const context = await browser.newContext({ javaScriptEnabled: false });
		const page = await context.newPage();
		await page.goto(`${origin}/resources`);
		await expect(page.locator('[data-chip]').first()).toBeHidden();
		const posts = page.locator('li[data-kind]');
		await expect(posts).toHaveCount(3);
		for (const post of await posts.all()) await expect(post).toBeVisible();
		await context.close();
	});

	test('the build checks fail and name the mismatch when /resources is in the sitemap but the page carries noindex', () => {
		const broken = join(dir, 'broken');
		cpSync(join(dir, 'dist'), broken, { recursive: true });
		const page = readFileSync(join(broken, 'resources.html'), 'utf8');
		writeFileSync(join(broken, 'resources.html'), page.replace('<meta charset="utf-8"', '<meta name="robots" content="noindex"><meta charset="utf-8"'));
		const problems: string[] = checkResourcesSwitch(broken);
		expect(problems).toHaveLength(1);
		expect(problems[0]).toContain('the Resources switch disagrees with itself');
		expect(problems[0]).toContain('off for indexing');
		expect(problems[0]).toContain('on for nav link, footer link, sitemap entry, llms.txt line');
	});
});
