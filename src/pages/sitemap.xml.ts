import { sitemapXml } from '../lib/seo-files';

// The a11ign-seo sitemap, with every lastmod set to the day of this build.
export function GET() {
	const today = new Date().toISOString().slice(0, 10);
	return new Response(sitemapXml(today), {
		headers: { 'Content-Type': 'application/xml; charset=utf-8' },
	});
}
