// Regenerates public/favicon.ico from public/favicon.svg (the a11ign mark on white): PNG frames packed into an .ico.
import { chromium } from '@playwright/test';
import { readFileSync, writeFileSync } from 'node:fs';

const sizes = [16, 32, 48];
const svg = readFileSync(new URL('../public/favicon.svg', import.meta.url), 'utf8');
const browser = await chromium.launch();
const page = await browser.newPage();
const frames = [];
for (const size of sizes) {
	await page.setViewportSize({ width: size, height: size });
	await page.setContent(`<style>html,body{margin:0;background:transparent}svg{display:block;width:${size}px;height:${size}px}</style>${svg}`);
	frames.push(await page.screenshot({ omitBackground: true, clip: { x: 0, y: 0, width: size, height: size } }));
}
await browser.close();

const header = Buffer.alloc(6);
header.writeUInt16LE(1, 2);
header.writeUInt16LE(frames.length, 4);
let offset = 6 + 16 * frames.length;
const entries = frames.map((png, i) => {
	const entry = Buffer.alloc(16);
	entry[0] = sizes[i];
	entry[1] = sizes[i];
	entry.writeUInt16LE(1, 4);
	entry.writeUInt16LE(32, 6);
	entry.writeUInt32LE(png.length, 8);
	entry.writeUInt32LE(offset, 12);
	offset += png.length;
	return entry;
});
writeFileSync(new URL('../public/favicon.ico', import.meta.url), Buffer.concat([header, ...entries, ...frames]));
