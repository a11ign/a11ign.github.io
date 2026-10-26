import { llmsTxt } from '../lib/seo-files';

export function GET() {
	return new Response(llmsTxt(), { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
}
