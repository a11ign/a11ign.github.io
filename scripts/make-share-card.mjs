// Remakes public/a11ign-share-card.png (2400x1260) from scripts/share-card/index.html, with the fonts the site already ships.
import { chromium } from '@playwright/test';
import { fileURLToPath } from 'node:url';

const source = fileURLToPath(new URL('./share-card/index.html', import.meta.url));
const target = fileURLToPath(new URL('../public/a11ign-share-card.png', import.meta.url));

const browser = await chromium.launch();
try {
	const page = await browser.newPage({ viewport: { width: 2400, height: 1260 }, deviceScaleFactor: 1 });
	await page.goto(`file://${source}`);
	await page.evaluate(() => document.fonts.ready);
	await page.screenshot({ path: target, clip: { x: 0, y: 0, width: 2400, height: 1260 } });
	console.log(`wrote ${target}`);
} finally {
	await browser.close();
}
