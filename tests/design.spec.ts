import { expect, test, type Page } from '@playwright/test';

// How each page marks its sections, what it highlights, and where. The design system's "Section headings" and "Highlighting" rules.
type Kind = 'chip' | 'marker' | 'plain' | 'none';
const SECTIONS: Record<string, { kind: Kind; count: number }> = {
	'/': { kind: 'chip', count: 5 },
	'/get-started': { kind: 'chip', count: 5 },
	'/docs/github-action': { kind: 'chip', count: 5 },
	'/what-it-checks': { kind: 'marker', count: 7 },
	'/docs/how-we-know-it-works': { kind: 'marker', count: 8 },
	'/docs/security': { kind: 'marker', count: 5 },
	'/docs/contributing': { kind: 'marker', count: 4 },
	'/about': { kind: 'marker', count: 7 },
	'/faq': { kind: 'marker', count: 6 },
	'/contact': { kind: 'plain', count: 3 },
	'/privacy': { kind: 'plain', count: 6 },
	'/cookies': { kind: 'plain', count: 3 },
	'/terms': { kind: 'plain', count: 3 },
	'/accessibility': { kind: 'plain', count: 5 },
	'/docs': { kind: 'none', count: 0 },
	'/resources': { kind: 'none', count: 0 },
	'/pricing': { kind: 'none', count: 0 },
};

const HIGHLIGHTS: Record<string, string[]> = {
	'/': ['hears it.'],
	'/get-started': ['your workflow'],
	'/about': ['They can’t hear your page.'],
	'/what-it-checks': ['Code checks pass while a screen reader user is stuck.'],
	'/docs/how-we-know-it-works': ['Every number here comes from real NVDA runs.'],
	'/docs/github-action': ['You don’t need a machine of your own, an account or an API key.'],
	'/docs/security': ['There’s no tracking and no phoning home.'],
	'/privacy': ['it sends nothing anywhere'],
	'/cookies': ['The a11ign software doesn’t use cookies.'],
	'/accessibility': ['this website should work for them too.'],
};
const H1_HIGHLIGHTS: Record<string, string> = { '/': 'hears it.', '/get-started': 'your workflow' };

interface Box { w: number; h: number; bg: string; border: string; shadow: string; radius: string; text: string | null }
const measure = (el: Element): Box => {
	const cs = getComputedStyle(el);
	const { width, height } = el.getBoundingClientRect();
	return { w: width, h: height, bg: cs.backgroundColor, border: cs.borderTopWidth, shadow: cs.boxShadow, radius: cs.borderTopLeftRadius, text: el.textContent };
};

/** The numbered chip: 44px, 8px radius, two digits; in light mode a 2px ink outline and a 3px hard shadow. */
function expectChip(box: Box, scheme: 'dark' | 'light') {
	expect(box.h).toBe(44);
	expect(box.w).toBeGreaterThanOrEqual(44);
	expect(box.radius).toBe('8px');
	expect(box.text).toMatch(/^\d{2}$/);
	if (scheme === 'light') {
		expect(box.border).toBe('2px');
		expect(box.shadow).toContain('3px 3px 0px 0px');
	} else expect(box.border).toBe('0px');
}

/** The square marker: 18px, 3px radius, no number; in light mode a 2px ink outline and a 2px hard shadow. */
function expectSquare(box: Box, scheme: 'dark' | 'light') {
	expect([box.w, box.h]).toEqual([18, 18]);
	expect(box.radius).toBe('3px');
	expect(box.text).toBe('');
	if (scheme === 'light') {
		expect(box.border).toBe('2px');
		expect(box.shadow).toContain('2px 2px 0px 0px');
	}
}

const marks = (page: Page) => page.$$eval('.hl, .a1-hl', (els) => els.map((el) => ({ text: el.textContent ?? '', inHeading: Boolean(el.closest('h1')) ? 'h1' : el.closest('h2, h3, h4') ? 'sub' : 'text' })));

for (const scheme of ['dark', 'light'] as const) {
	test.describe(`section headings and highlights · ${scheme}`, () => {
		test.use({ colorScheme: scheme, viewport: { width: 1440, height: 900 } });

		for (const [path, expected] of Object.entries(SECTIONS)) {
			test(`${path}: ${expected.count} ${expected.kind} section headings`, async ({ page }) => {
				await page.goto(path);
				const sh = page.locator('main .sh');
				await expect(sh).toHaveCount(expected.count);
				for (const heading of await sh.all()) {
					// A divider above, the h2 inside, and the marker if the kind has one.
					expect(await heading.evaluate((el) => getComputedStyle(el).borderTopWidth)).toBe('1px');
					await expect(heading.locator('h2')).toHaveCount(1);
					const num = heading.locator('.num');
					if (expected.kind === 'plain') {
						await expect(num).toHaveCount(0);
						continue;
					}
					await expect(num).toHaveCount(1);
					await expect(num).toHaveAttribute('aria-hidden', 'true');
					const box = await num.evaluate(measure);
					expect(box.bg).toBe('rgb(212, 255, 58)');
					if (expected.kind === 'chip') expectChip(box, scheme);
					else expectSquare(box, scheme);
				}
				if (expected.kind === 'chip') {
					const numbers = await sh.locator('.num').allTextContents();
					expect(numbers).toEqual(numbers.map((_, i) => String(i + 1).padStart(2, '0')));
				}
				// No h2 anywhere in the page's sections is highlighted, and no heading level below h1 ever is.
				await expect(page.locator('h2 .hl, h2 .a1-hl, h3 .hl, h3 .a1-hl')).toHaveCount(0);
			});
		}

		for (const path of Object.keys(SECTIONS)) {
			test(`${path}: the highlighter marks only what the plan lists`, async ({ page }) => {
				await page.goto(path);
				const found = await marks(page);
				expect(found.map((m) => m.text)).toEqual(HIGHLIGHTS[path] ?? []);
				expect(found.filter((m) => m.inHeading === 'sub')).toEqual([]);
				const h1Marks = found.filter((m) => m.inHeading === 'h1').map((m) => m.text);
				expect(h1Marks).toEqual(H1_HIGHLIGHTS[path] ? [H1_HIGHLIGHTS[path]] : []);
				expect(found.length).toBeLessThanOrEqual(1);
			});
		}
	});
}

test.describe('no card on Security carries a marker', () => {
	test('markers are only beside section headings', async ({ page }) => {
		await page.goto('/docs/security');
		await expect(page.locator('.a1-card .num, .set .num, .rm .num')).toHaveCount(0);
		await expect(page.locator('main .num')).toHaveCount(5);
	});
});

test.describe('plain text lists', () => {
	for (const scheme of ['dark', 'light'] as const) {
		test(`${scheme}: Contributing's "Ways to help" has a 10px lime square bullet and text 26px in`, async ({ browser }) => {
			const context = await browser.newContext({ colorScheme: scheme });
			const page = await context.newPage();
			await page.goto('/docs/contributing');
			const items = page.locator('main section').first().locator('li');
			await expect(items).toHaveCount(4);
			for (const item of await items.all()) {
				const style = await item.evaluate((el) => {
					const li = getComputedStyle(el);
					const before = getComputedStyle(el, '::before');
					return { list: li.listStyleType, pad: li.paddingLeft, w: before.width, h: before.height, bg: before.backgroundColor, radius: before.borderTopLeftRadius, border: before.borderTopWidth, shadow: before.boxShadow };
				});
				expect(style).toMatchObject({ list: 'none', pad: '26px', w: '10px', h: '10px', bg: 'rgb(212, 255, 58)', radius: '2px' });
				if (scheme === 'light') {
					// The browser rounds a used border to a whole device pixel, so the 1.5px outline is read from the stylesheet.
					expect(await page.evaluate(() => [...document.styleSheets].flatMap((sheet) => [...sheet.cssRules]).some((rule) => rule instanceof CSSStyleRule && rule.selectorText.includes('::before') && rule.cssText.includes('border: 1.5px solid')))).toBe(true);
					expect(style.border).not.toBe('0px');
					expect(style.shadow).toContain('1.5px 1.5px 0px 0px');
				} else expect(style.border).toBe('0px');
			}
			await context.close();
		});
	}
});

test.describe('Home', () => {
	for (const scheme of ['dark', 'light'] as const) {
		test(`${scheme}: the hero pills and the muted line between the buttons and the pills`, async ({ browser }) => {
			const context = await browser.newContext({ colorScheme: scheme });
			const page = await context.newPage();
			await page.goto('/');
			await expect(page.getByRole('list', { name: 'Key facts' }).getByRole('listitem')).toHaveText(['Free and open source', 'No data sent to us']);
			const order = await page.evaluate(() => {
				const hero = document.querySelector('.hero .in')!;
				return [...hero.children].map((el) => el.className || el.tagName.toLowerCase());
			});
			expect(order.slice(-3)).toEqual(['btns', 'aud', 'facts']);
			const aud = page.getByText('For developers and QA teams who ship web apps.');
			await expect(aud).toBeVisible();
			expect(await aud.evaluate((el) => getComputedStyle(el).color)).toBe(scheme === 'dark' ? 'rgb(208, 198, 230)' : 'rgb(76, 66, 102)');
			await context.close();
		});
	}
});

test.describe('Home steps', () => {
	test('the steps carry no number circles, because the section chips already number the page', async ({ page }) => {
		await page.goto('/');
		await expect(page.locator('main .sh .num')).toHaveText(['01', '02', '03', '04', '05']);
		await expect(page.locator('.a1-step-n')).toHaveCount(0);
		await expect(page.locator('ul.steps > li')).toHaveText([
			'Add a few lines to your GitHub project.',
			'GitHub runs a11ign on a Windows machine, with a real screen reader.',
			'Read the report on your pull request.',
		]);
		await expect(page.locator('.ag .a1-step')).toHaveText(['Install the skill', 'Ask in plain words']);
	});

	test('Get started keeps the numbered install steps', async ({ page }) => {
		await page.goto('/get-started');
		await expect(page.locator('.a1-step-n').first()).toBeVisible();
	});
});

test.describe('Footer and follow links', () => {
	test('the footer lists X, LinkedIn and Reddit, LinkedIn goes to the company page, and there is no YouTube', async ({ page }) => {
		await page.goto('/');
		const links = page.getByRole('contentinfo').getByRole('list', { name: 'Follow us' }).getByRole('link');
		await expect(links).toHaveText(['X', 'LinkedIn (opens in a new tab)', 'Reddit']);
		await expect(links.nth(1)).toHaveAttribute('href', 'https://www.linkedin.com/company/a11ign');
		await expect(page.getByRole('contentinfo').getByText('YouTube')).toHaveCount(0);
	});

	test('the gap between the X and LinkedIn text is no wider than the LinkedIn and Reddit one, plus a few pixels', async ({ page }) => {
		await page.setViewportSize({ width: 1440, height: 900 });
		await page.goto('/');
		const gaps = await page.$$eval('.sf .soc .fl', (links) => {
			const rects = links.map((link) => {
				const range = document.createRange();
				range.selectNodeContents(link.firstChild!); // the visible text, not the hidden "(opens in a new tab)"
				return range.getBoundingClientRect();
			});
			return rects.slice(1).map((rect, i) => rect.left - rects[i].right);
		});
		expect(gaps[0]).toBeLessThan(30);
		expect(gaps[0] - gaps[1]).toBeLessThan(8);
	});

	test('Contact follows the footer: no YouTube, and the LinkedIn link is the company page without a placeholder', async ({ page }) => {
		await page.goto('/contact');
		await expect(page.getByText('YouTube')).toHaveCount(0);
		const linkedin = page.locator('p', { hasText: 'Follow us:' }).getByRole('link', { name: 'LinkedIn (opens in a new tab)', exact: true });
		await expect(linkedin).toHaveAttribute('href', 'https://www.linkedin.com/company/a11ign');
	});
});

test.describe('About', () => {
	test('the roadmap section has no buttons: the two below it are the only pair', async ({ page }) => {
		await page.goto('/about');
		await expect(page.locator('section[aria-labelledby="next"] a.a1-btn')).toHaveCount(0);
		await expect(page.locator('main a.a1-btn')).toHaveText(['Add to your workflow', 'Star on GitHub (opens in a new tab)']);
	});
});

test.describe('Get started', () => {
	test('the 40-character commit note sits directly under the workflow code block, above steps 1 to 3', async ({ page }) => {
		await page.goto('/get-started');
		const section = page.locator('section[aria-labelledby="r1"]');
		const children = await section.evaluate((el) => [...el.children].filter((child) => child.tagName !== 'SCRIPT').map((child) => `${child.tagName.toLowerCase()}.${child.className}`));
		const code = children.indexOf('div.a1-code');
		expect(children[code + 1]).toBe('p.note');
		expect(children[code + 2]).toBe('ol.steps');
		await expect(section.locator('p.note')).toHaveText('Check the version it pins. It should be a full 40-character commit from an a11ign@ release.');
		await expect(page.locator('section[aria-labelledby="agent"] p.note')).toHaveCount(0);
	});

	test('"What you need" for the GitHub Action names the Windows minutes', async ({ page }) => {
		await page.goto('/get-started');
		const card = page.locator('.need > div').first();
		await expect(card.locator('li')).toHaveText([
			'A GitHub project',
			'GitHub Actions minutes. a11ign is free, but in a private repository runs use Windows minutes, which cost more than Linux ones',
		]);
	});
});

test.describe('FAQ', () => {
	test('"Do we process your data?" answers no, and says what it talks to', async ({ page }) => {
		await page.goto('/faq');
		const item = page.locator('details', { hasText: 'Do we process your data?' });
		await expect(item.locator('summary')).toHaveText('Do we process your data?');
		await expect(item.locator('.ans')).toHaveText('No. It only talks to the page you point it at and your own machine. No tracking, no phoning home.');
		await expect(page.getByText('What does it send anywhere?')).toHaveCount(0);
	});

	test('the run-cost answer says the Windows minutes cost more in a private repository', async ({ page }) => {
		await page.goto('/faq');
		const answer = page.locator('details', { hasText: 'How long does a run take, and what does it cost?' }).locator('.ans');
		await expect(answer).toContainText('In a private repository, GitHub charges more per minute for Windows runners than for Linux ones');
	});
});

test.describe('How we know it works and About', () => {
	test('no heading starts with "Step 1", "Step 2" or "Step 3"', async ({ page }) => {
		await page.goto('/docs/how-we-know-it-works');
		const headings = await page.$$eval('h1, h2, h3', (els) => els.map((el) => el.textContent ?? ''));
		expect(headings.filter((text) => /^Step \d/.test(text))).toEqual([]);
		expect(headings).toEqual(expect.arrayContaining(['Learning from pairs of pages', 'A test set it never saw', 'Real websites', 'The quick check']));
	});

	for (const scheme of ['dark', 'light'] as const) {
		test(`${scheme}: the stat row, 99.71% and 57% are large numerals`, async ({ browser }) => {
			const context = await browser.newContext({ colorScheme: scheme, viewport: { width: 1440, height: 900 } });
			const page = await context.newPage();
			const size = (selector: string) => page.locator(selector).first().evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
			await page.goto('/docs/how-we-know-it-works');
			await expect(page.locator('.stat .nm')).toHaveText(['4,668', '1,250', '231', '129']);
			expect(await size('.stat .nm')).toBeGreaterThanOrEqual(64);
			await expect(page.locator('.bignum')).toHaveText('99.71%');
			expect(await size('.bignum')).toBeGreaterThanOrEqual(72);
			await page.goto('/about');
			await expect(page.locator('.bignum')).toHaveText('57%');
			expect(await size('.bignum')).toBeGreaterThanOrEqual(72);
			// A numeral is never a second highlight: in light mode it is ink on white, not ink on lime.
			if (scheme === 'light') expect(await page.locator('.bignum span').evaluate((el) => getComputedStyle(el).backgroundColor)).toBe('rgba(0, 0, 0, 0)');
			await context.close();
		});
	}

	test('every roadmap card says "Coming soon" or "Planned"', async ({ page }) => {
		for (const path of ['/about', '/docs/how-we-know-it-works']) {
			await page.goto(path);
			await expect(page.locator('.rm .a1-badge')).toHaveText(['Coming soon', 'Planned', 'Planned', 'Planned']);
		}
	});
});

test.describe('Security', () => {
	test('"What it does to a page" is a card grid, "Stay safe" three cards, "What it sends" a paragraph, and the report card is one card', async ({ page }) => {
		await page.goto('/docs/security');
		await expect(page.locator('table')).toHaveCount(0);
		await expect(page.locator('section[aria-labelledby="s1"] .a1-card')).toHaveCount(5);
		await expect(page.locator('section[aria-labelledby="s2"] .set')).toHaveCount(3);
		await expect(page.locator('section[aria-labelledby="s3"] :is(.set, .a1-card)')).toHaveCount(0);
		await expect(page.locator('section[aria-labelledby="s3"] p')).toContainText('Nothing. It talks to the page you point it at');
		await expect(page.locator('section[aria-labelledby="s4"] .set')).toHaveCount(1);
	});
});

test.describe('GitHub Action guide', () => {
	test('the settings are cards with a "Default" pill, the outputs are cards, and there are no tables', async ({ page }) => {
		await page.goto('/docs/github-action');
		await expect(page.locator('table')).toHaveCount(0);
		await expect(page.locator('section[aria-labelledby="d2"] .set')).toHaveCount(7);
		await expect(page.locator('section[aria-labelledby="d2"] .def')).toHaveText(['Required', 'Default: Read and understand this page', 'Default: never', 'Default: off', 'Default: on', 'Default: local']);
		await expect(page.locator('section[aria-labelledby="d3"] .set')).toHaveCount(4);
		await expect(page.locator('section[aria-labelledby="d1"] ol.stp li')).toHaveCount(3);
		await expect(page.locator('section[aria-labelledby="d4"] .rows h3')).toHaveText(['It runs on Windows', 'Your build is safe', 'Use it where it counts']);
	});
});

test.describe('copy rules', () => {
	test('"screen-reader" and "Nothing leaves your machine" appear on no page, in any head tag or in llms.txt', async ({ page, request }) => {
		const paths = ['/', '/get-started', '/what-it-checks', '/docs', '/docs/github-action', '/docs/how-we-know-it-works', '/docs/security', '/docs/contributing', '/resources', '/about', '/faq', '/contact', '/privacy', '/cookies', '/terms', '/accessibility', '/pricing'];
		for (const path of paths) {
			const text = await (await page.request.get(path, { failOnStatusCode: false })).text();
			expect(text, path).not.toMatch(/screen-reader/i);
			expect(text, path).not.toMatch(/nothing leaves your machine/i);
		}
		for (const file of ['/llms.txt', '/sitemap.xml']) {
			const text = await (await request.get(file)).text();
			expect(text, file).not.toMatch(/screen-reader/i);
			expect(text, file).not.toMatch(/nothing leaves your machine/i);
		}
	});

	test('the share card keeps its size and the share image alt text has no hyphen', async ({ request, page }) => {
		const png = Buffer.from(await (await request.get('/a11ign-share-card.png')).body());
		expect([png.readUInt32BE(16), png.readUInt32BE(20)]).toEqual([2400, 1260]);
		await page.goto('/');
		expect(await page.locator('meta[property="og:image:alt"]').getAttribute('content')).toBe('a11ign: test accessibility the way a screen reader user hears it');
		expect(await page.locator('meta[name="twitter:image:alt"]').getAttribute('content')).toBe('a11ign: test accessibility the way a screen reader user hears it');
	});
});

test.describe('motion', () => {
	test('prefers-reduced-motion removes every transition', async ({ browser }) => {
		const context = await browser.newContext({ reducedMotion: 'reduce' });
		const page = await context.newPage();
		for (const path of ['/', '/get-started', '/docs', '/resources', '/docs/security']) {
			await page.goto(path);
			const moving = await page.$$eval('body *', (els) => els.filter((el) => parseFloat(getComputedStyle(el).transitionDuration) > 0).map((el) => `${el.tagName}.${el.className}`));
			expect(moving, path).toEqual([]);
		}
		await context.close();
	});
});
