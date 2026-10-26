import { defineMiddleware } from 'astro:middleware';
import { markExternalLinks } from './lib/external-links';

// Every page is rendered at build time, and this runs over each one's HTML.
export const onRequest = defineMiddleware(async (_context, next) => {
	const response = await next();
	if (!response.headers.get('content-type')?.includes('text/html')) return response;
	return new Response(markExternalLinks(await response.text()), { status: response.status, headers: response.headers });
});
