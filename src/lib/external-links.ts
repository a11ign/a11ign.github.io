const SITE_HOSTS = new Set(['www.a11ign.com', 'a11ign.com']);
const NEW_TAB_HINT = 'opens in a new tab';
const ANCHOR = /<a\b([^>]*)>([\s\S]*?)<\/a>/g;

/** A link that leaves the a11ign website: a full http(s) address on any other host, GitHub included. */
export function isExternalHref(href: string): boolean {
	if (!/^https?:\/\//i.test(href)) return false;
	try {
		return !SITE_HOSTS.has(new URL(href).hostname);
	} catch {
		return false;
	}
}

/**
 * Makes every link that leaves the site open in a new tab, and says so to a screen reader: the visible text stays as designed,
 * and a hidden "(opens in a new tab)" follows it (or goes into the link's aria-label when it has one).
 * Runs over each page's HTML at build time, so a link added later is covered without anyone remembering.
 */
export function markExternalLinks(html: string): string {
	return html.replace(ANCHOR, (anchor, attrs: string, inner: string) => {
		const href = /\shref="([^"]*)"/.exec(attrs)?.[1];
		if (!href || !isExternalHref(href) || /\starget=/.test(attrs)) return anchor;
		const opened = `${attrs} target="_blank" rel="noopener noreferrer"`;
		const label = /\saria-label="([^"]*)"/.exec(attrs);
		if (label) return `<a${opened.replace(label[0], ` aria-label="${label[1]} (${NEW_TAB_HINT})"`)}>${inner}</a>`;
		return `<a${opened}>${inner}<span class="ext-hint"> (${NEW_TAB_HINT})</span></a>`;
	});
}
