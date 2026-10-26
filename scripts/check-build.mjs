// Static checks on the built site: what dist/ must and must not contain, and that a pull request
// preview build (BASE_PATH=/pr-preview/pr-1/) keeps every internal link and asset under its base.
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, rmSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from '@playwright/test';
import { serve } from './serve.mjs';
import { checkResourcesSwitch, resourcesSignals } from './resources-switch.mjs';

const failures = [];
const check = (ok, message) => {
	if (!ok) failures.push(message);
};

function* walk(dir) {
	for (const name of readdirSync(dir)) {
		const file = join(dir, name);
		if (statSync(file).isDirectory()) yield* walk(file);
		else yield file;
	}
}
const textFiles = (dir) => [...walk(dir)].filter((f) => /\.(html|css|js|xml|txt|svg)$/.test(f));
const seo = (name) => readFileSync(new URL(`../src/data/seo/${name}`, import.meta.url), 'utf8');

// Nothing points at Google Fonts, no script writes a cookie, and the two phrases the copy rules ban appear nowhere.
// "Screen-reader" is always two words, and "nothing leaves your machine" is untrue because the Action runs on a GitHub machine.
for (const file of textFiles('dist')) {
	const text = readFileSync(file, 'utf8');
	check(!/fonts\.(googleapis|gstatic)\.com/.test(text), `${file} mentions Google Fonts`);
	check(!text.includes('document.cookie'), `${file} writes document.cookie`);
	check(!/screen-reader/i.test(text), `${file} says "screen-reader", which is two words`);
	check(!/nothing leaves your machine/i.test(text), `${file} says "nothing leaves your machine"`);
}

// The Resources switch: nav, footer, sitemap, llms.txt, indexing and the chips either all agree or the build fails.
for (const problem of checkResourcesSwitch('dist')) check(false, problem);
const resourcesLive = resourcesSignals('dist').every(Boolean);

// robots.txt is the a11ign-seo file byte for byte, and so is llms.txt while Resources is off.
check(readFileSync('dist/robots.txt', 'utf8') === seo('robots.txt'), 'dist/robots.txt differs from the a11ign-seo file');
if (!resourcesLive) check(readFileSync('dist/llms.txt', 'utf8') === seo('llms.txt'), 'dist/llms.txt differs from the a11ign-seo file');

// The sitemap lists the pages on the live domain, each with this build's date: 15, and /resources makes 16.
const expectedUrls = resourcesLive ? 16 : 15;
const sitemap = readFileSync('dist/sitemap.xml', 'utf8');
const entries = [...sitemap.matchAll(/<loc>([^<]+)<\/loc><lastmod>([^<]+)<\/lastmod>/g)];
check(entries.length === expectedUrls, `sitemap lists ${entries.length} URLs, expected ${expectedUrls}`);
check(!sitemap.includes('[YYYY-MM-DD]'), 'sitemap still has [YYYY-MM-DD]');
check(!/404/.test(sitemap), 'sitemap lists the 404 page');
const today = new Date().toISOString().slice(0, 10);
for (const [, loc, lastmod] of entries) {
	check(loc.startsWith('https://www.a11ign.com/') || loc === 'https://www.a11ign.com/', `${loc} is not on https://www.a11ign.com`);
	check(lastmod === today, `${loc} lastmod is ${lastmod}, expected ${today}`);
}

// A preview build keeps every internal link and asset under its base, and canonicals off it.
const BASE = '/pr-preview/pr-1/';
rmSync('dist-preview', { recursive: true, force: true });
execFileSync('npx', ['astro', 'build', '--outDir', 'dist-preview'], { env: { ...process.env, BASE_PATH: BASE }, stdio: 'pipe' });
const internal = /\s(?:href|src)="(\/[^"]*)"/g;
let checked = 0;
for (const file of [...walk('dist-preview')].filter((f) => f.endsWith('.html'))) {
	const html = readFileSync(file, 'utf8');
	for (const [, url] of html.matchAll(internal)) {
		checked += 1;
		check(url.startsWith('/pr-preview/pr-1/') || url === '/pr-preview/pr-1', `${file}: ${url} is not under the preview base`);
	}
	for (const [, url] of html.matchAll(/url\((["']?)(\/[^)"']+)\1\)/g)) check(false, `${file}: inline CSS url ${url}`);
	const canonical = html.match(/<link rel="canonical" href="([^"]+)"/)?.[1];
	// A noindex page (the 404, and Resources while it is off) has no canonical.
	if (!/<meta name="robots" content="noindex"/.test(html)) check(canonical?.startsWith('https://www.a11ign.com') && !canonical.includes('pr-preview'), `${file}: canonical is ${canonical}`);
	check(!/og:url" content="[^"]*pr-preview/.test(html), `${file}: og:url has the preview base`);
}
for (const file of textFiles('dist-preview').filter((f) => f.endsWith('.css'))) {
	for (const [, , url] of readFileSync(file, 'utf8').matchAll(/url\((["']?)(\/[^)"']+)\1\)/g)) {
		check(url.startsWith('/pr-preview/pr-1/'), `${file}: ${url} is not under the preview base`);
	}
}
// In a browser, under the preview base: every request succeeds, the three fonts load, and the scripts run.
const { server, port } = await serve(join(process.cwd(), 'dist-preview'), { base: BASE });
const browser = await chromium.launch();
try {
	for (const route of ['', 'get-started', 'docs/github-action', 'resources', 'faq']) {
		const page = await browser.newPage();
		const bad = [];
		page.on('response', (response) => response.status() >= 400 && bad.push(`${response.status()} ${response.url()}`));
		page.on('pageerror', (error) => bad.push(`script error: ${error.message}`));
		await page.goto(`http://127.0.0.1:${port}${BASE}${route}`);
		await page.evaluate(() => document.fonts.ready);
		const families = await page.evaluate(() => [...new Set([...document.fonts].filter((f) => f.status === 'loaded').map((f) => f.family))]);
		check(bad.length === 0, `${BASE}${route}: ${bad.join(', ')}`);
		check(families.includes('Lexend') && families.includes('Bricolage Grotesque'), `${BASE}${route}: fonts loaded were ${families.join(', ')}`);
		await page.getByRole('button', { name: /Switch to (light|dark) theme/ }).click();
		check((await page.locator('html').getAttribute('data-theme')) !== null, `${BASE}${route}: the theme toggle did nothing`);
		await page.close();
	}
} finally {
	await browser.close();
	server.close();
}
check(checked > 100, `only ${checked} internal URLs were checked`);
check(existsSync('dist-preview/index.html'), 'preview build has no index.html');
rmSync('dist-preview', { recursive: true, force: true });

if (failures.length) {
	console.error(`check-build: ${failures.length} problem(s)\n${failures.map((f) => `  - ${f}`).join('\n')}`);
	process.exit(1);
}
console.log(`check-build: ok (${checked} internal URLs under ${BASE})`);
