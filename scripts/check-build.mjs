// Static checks on the built site: what dist/ must and must not contain, and that a pull request
// preview build (BASE_PATH=/pr-preview/pr-1/) keeps every internal link and asset under its base.
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, rmSync, statSync } from 'node:fs';
import { join } from 'node:path';

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

// Nothing points at Google Fonts, and no script writes a cookie.
for (const file of textFiles('dist')) {
	const text = readFileSync(file, 'utf8');
	check(!/fonts\.(googleapis|gstatic)\.com/.test(text), `${file} mentions Google Fonts`);
	check(!text.includes('document.cookie'), `${file} writes document.cookie`);
}

// robots.txt and llms.txt are the a11ign-seo files, byte for byte.
for (const name of ['robots.txt', 'llms.txt']) {
	check(readFileSync(`dist/${name}`, 'utf8') === seo(name), `dist/${name} differs from the a11ign-seo file`);
}

// The sitemap lists the 16 pages on the live domain, each with this build's date.
const sitemap = readFileSync('dist/sitemap.xml', 'utf8');
const entries = [...sitemap.matchAll(/<loc>([^<]+)<\/loc><lastmod>([^<]+)<\/lastmod>/g)];
check(entries.length === 16, `sitemap lists ${entries.length} URLs, expected 16`);
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
	if (!file.endsWith('404.html')) check(canonical?.startsWith('https://www.a11ign.com') && !canonical.includes('pr-preview'), `${file}: canonical is ${canonical}`);
	check(!/og:url" content="[^"]*pr-preview/.test(html), `${file}: og:url has the preview base`);
}
for (const file of textFiles('dist-preview').filter((f) => f.endsWith('.css'))) {
	for (const [, , url] of readFileSync(file, 'utf8').matchAll(/url\((["']?)(\/[^)"']+)\1\)/g)) {
		check(url.startsWith('/pr-preview/pr-1/'), `${file}: ${url} is not under the preview base`);
	}
}
check(checked > 100, `only ${checked} internal URLs were checked`);
check(existsSync('dist-preview/index.html'), 'preview build has no index.html');
rmSync('dist-preview', { recursive: true, force: true });

if (failures.length) {
	console.error(`check-build: ${failures.length} problem(s)\n${failures.map((f) => `  - ${f}`).join('\n')}`);
	process.exit(1);
}
console.log(`check-build: ok (${checked} internal URLs under ${BASE})`);
