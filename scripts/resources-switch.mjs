// The Resources switch (src/data/resources.ts) turns six things on or off together. This reads all six out of a built
// site, by name, and reports any that disagree with the rest, so a half-launched Resources page cannot ship.
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const RESOURCES_LINK = /href="[^"]*\/resources"/;

export function resourcesSignals(dir) {
	const read = (name) => readFileSync(join(dir, name), 'utf8');
	const home = read('index.html');
	const nav = home.slice(home.indexOf('class="sn"'), home.indexOf('</header>'));
	const footer = home.slice(home.indexOf('<footer'), home.indexOf('</footer>'));
	const page = read('resources.html');
	return {
		'nav link': RESOURCES_LINK.test(nav),
		'footer link': RESOURCES_LINK.test(footer),
		'sitemap entry': read('sitemap.xml').includes('https://www.a11ign.com/resources</loc>'),
		'llms.txt line': read('llms.txt').includes('](https://www.a11ign.com/resources)'),
		indexing: !/<meta name="robots" content="noindex"/.test(page),
		'filter chips and "All resources"': page.includes('data-chip=') && page.includes('id="all"'),
	};
}

/** True when all six outputs are on. */
export const resourcesAreLive = (dir) => Object.values(resourcesSignals(dir)).every(Boolean);

/** Returns the problems found: empty when all six outputs are on, or all six are off. */
export function checkResourcesSwitch(dir) {
	if (!existsSync(join(dir, 'resources.html'))) return [`${dir}/resources.html is missing`];
	const outputs = Object.entries(resourcesSignals(dir));
	const on = outputs.filter(([, isOn]) => isOn).map(([name]) => name);
	const off = outputs.filter(([, isOn]) => !isOn).map(([name]) => name);
	if (on.length === 0 || off.length === 0) return [];
	return [`the Resources switch disagrees with itself: on for ${on.join(', ')}; off for ${off.join(', ')}`];
}
