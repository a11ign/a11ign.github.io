import robots from '../data/seo/robots.txt?raw';

export function GET() {
	return new Response(robots, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
}
