import { expect, test } from '@playwright/test';
import { isExternalHref, markExternalLinks } from '../src/lib/external-links';
import { PAGES } from './pages';

test.describe('markExternalLinks', () => {
	test('opens a link to another site in a new tab and says so after its text', () => {
		expect(markExternalLinks('<a class="x" href="https://example.com/a?b=1&amp;c=2">Read it</a>')).toBe(
			'<a class="x" href="https://example.com/a?b=1&amp;c=2" target="_blank" rel="noopener noreferrer">Read it<span class="ext-hint"> (opens in a new tab)</span></a>',
		);
	});

	test('puts the hint into an aria-label instead when the link has one', () => {
		expect(markExternalLinks('<a href="https://github.com/a11ign/a11ign" aria-label="Star on GitHub"><svg></svg>Star</a>')).toBe(
			'<a href="https://github.com/a11ign/a11ign" aria-label="Star on GitHub (opens in a new tab)" target="_blank" rel="noopener noreferrer"><svg></svg>Star</a>',
		);
	});

	test('leaves the site\'s own links, in-page links, mail links and placeholders alone', () => {
		for (const href of ['/docs', '#main', '#', 'mailto:hello@a11ign.com', 'https://www.a11ign.com/docs', 'https://a11ign.com/', '/pr-preview/pr-5/docs']) {
			const link = `<a href="${href}">Go</a>`;
			expect(markExternalLinks(link)).toBe(link);
		}
		expect(isExternalHref('https://www.a11ign.com.evil.example/')).toBe(true);
	});

	test('does not touch a link that already sets a target, or other tags that start with a', () => {
		const set = '<a href="https://example.com" target="_self">Stay</a>';
		expect(markExternalLinks(set)).toBe(set);
		const other = '<abbr title="x">y</abbr><article></article>';
		expect(markExternalLinks(other)).toBe(other);
	});
});

test.describe('external links in the built site', () => {
	for (const { path } of PAGES) {
		test(`${path}: every link that leaves a11ign opens in a new tab, says so, and no internal link does`, async ({ page }) => {
			await page.goto(path);
			const links = await page.$$eval('a[href]', (anchors) =>
				anchors.map((a) => ({
					href: a.getAttribute('href') ?? '',
					target: a.getAttribute('target'),
					rel: a.getAttribute('rel'),
					name: a.getAttribute('aria-label') ?? a.textContent ?? '',
				})),
			);
			const external = links.filter((link) => /^https?:\/\//.test(link.href) && !/^https:\/\/(www\.)?a11ign\.com(\/|$)/.test(link.href));
			expect(external.length).toBeGreaterThan(0);
			for (const link of external) {
				expect(link, link.href).toMatchObject({ target: '_blank', rel: 'noopener noreferrer' });
				expect(link.name, link.href).toContain('(opens in a new tab)');
			}
			for (const link of links.filter((l) => !external.includes(l))) expect(link.target, link.href).toBeNull();
		});
	}

	test('GitHub counts as outside: the nav, the Star pill and the hero button all open a new tab', async ({ page }) => {
		await page.goto('/');
		for (const link of await page.locator('a[href="https://github.com/a11ign/a11ign"]').all()) await expect(link).toHaveAttribute('target', '_blank');
		await expect(page.getByRole('navigation', { name: 'Main', exact: true }).getByRole('link', { name: 'GitHub (opens in a new tab)' })).toBeVisible();
	});

	test('the hint is read aloud and not shown', async ({ page }) => {
		await page.goto('/contact');
		const hint = page.locator('.ext-hint').first();
		const box = await hint.boundingBox();
		expect(box?.width).toBeLessThanOrEqual(1);
		expect(await hint.evaluate((el) => getComputedStyle(el).position)).toBe('absolute');
	});
});
