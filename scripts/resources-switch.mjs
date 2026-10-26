// The Resources switch (src/data/resources.ts) turns six things on or off together. This reads all six out of a built
// site and reports any that disagree with the rest, so a half-launched Resources page cannot ship.
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const OUTPUTS = ['nav link', 'footer link', 'sitemap entry', 'llms.txt line', 'indexing', 'filter chips and "All resources"'];
const RESOURCES_LINK = /href="[^"]*\/resources"/;

export function resourcesSignals(dir) {
	const read = (name) => readFileSync(join(dir, name), 'utf8');
	const home = read('index.html');
	const nav = home.slice(home.indexOf('class="sn"'), home.indexOf('</header>'));
	const footer = home.slice(home.indexOf('<footer'), home.indexOf('</footer>'));
	const page = read('resources.html');
	return [
		RESOURCES_LINK.test(nav),
		RESOURCES_LINK.test(footer),
		read('sitemap.xml').includes('https://www.a11ign.com/resources</loc>'),
		read('llms.txt').includes('](https://www.a11ign.com/resources)'),
		!/<meta name="robots" content="noindex"/.test(page),
		page.includes('data-chip=') && page.includes('id="all"'),
	];
}

/** Returns the problems found: empty when all six outputs are on, or all six are off. */
export function checkResourcesSwitch(dir) {
	if (!existsSync(join(dir, 'resources.html'))) return [`${dir}/resources.html is missing`];
	const signals = resourcesSignals(dir);
	if (signals.every(Boolean) || !signals.some(Boolean)) return [];
	const on = OUTPUTS.filter((_, i) => signals[i]);
	const off = OUTPUTS.filter((_, i) => !signals[i]);
	return [`the Resources switch disagrees with itself: on for ${on.join(', ')}; off for ${off.join(', ')}`];
}
