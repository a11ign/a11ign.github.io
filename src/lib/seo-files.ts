import llms from '../data/seo/llms.txt?raw';
import sitemap from '../data/seo/sitemap.xml?raw';
import { resourcesLive } from '../data/resources';

// The a11ign-seo pack leaves Resources out. These are the entry and the line it had, put back when Resources goes live.
const SITEMAP_ENTRY = '  <url><loc>https://www.a11ign.com/resources</loc><lastmod>[YYYY-MM-DD]</lastmod><priority>0.7</priority></url>\n';
const SITEMAP_BEFORE = '  <url><loc>https://www.a11ign.com/about</loc>';
const LLMS_LINE = '- [Resources](https://www.a11ign.com/resources): How-tos, guides and articles for testing with a real screen reader.\n';
const LLMS_BEFORE = '- [About a11ign](';

function insertBefore(text: string, marker: string, addition: string): string {
	const at = text.indexOf(marker);
	if (at < 0) throw new Error(`Cannot find ${marker} in the a11ign-seo file`);
	return text.slice(0, at) + addition + text.slice(at);
}

/** The pack's sitemap with the build date in every lastmod, plus /resources when it is live. */
export function sitemapXml(today: string): string {
	const withResources = resourcesLive ? insertBefore(sitemap, SITEMAP_BEFORE, SITEMAP_ENTRY) : sitemap;
	return withResources.replaceAll('[YYYY-MM-DD]', today);
}

/** The pack's llms.txt, byte for byte while Resources is off. */
export function llmsTxt(): string {
	return resourcesLive ? insertBefore(llms, LLMS_BEFORE, LLMS_LINE) : llms;
}
