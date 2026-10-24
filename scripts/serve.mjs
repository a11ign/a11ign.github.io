// A small static server for dist/ that answers like GitHub Pages: /docs serves docs.html, and an
// unknown address serves 404.html with a 404 status. `base` is the preview prefix, e.g. /pr-preview/pr-1.
import { createServer } from 'node:http';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { extname, join, normalize } from 'node:path';

const types = {
	'.html': 'text/html; charset=utf-8',
	'.css': 'text/css; charset=utf-8',
	'.js': 'text/javascript; charset=utf-8',
	'.svg': 'image/svg+xml',
	'.png': 'image/png',
	'.ico': 'image/x-icon',
	'.xml': 'application/xml; charset=utf-8',
	'.txt': 'text/plain; charset=utf-8',
	'.woff': 'font/woff',
	'.woff2': 'font/woff2',
};

function resolveFile(dir, pathname) {
	const clean = normalize(decodeURIComponent(pathname)).replace(/^(\.\.[/\\])+/, '');
	const candidates = [clean, `${clean}.html`, join(clean, 'index.html')];
	for (const candidate of candidates) {
		const file = join(dir, candidate);
		if (file.startsWith(dir) && existsSync(file) && statSync(file).isFile()) return file;
	}
	return null;
}

export function serve(dir, { port = 0, base = '' } = {}) {
	const prefix = base.replace(/\/$/, '');
	const server = createServer((req, res) => {
		const pathname = new URL(req.url ?? '/', 'http://localhost').pathname;
		let rest = null;
		if (pathname === prefix || pathname.startsWith(`${prefix}/`)) rest = pathname.slice(prefix.length) || '/';
		const file = rest === null ? null : resolveFile(dir, rest);
		const found = file ?? join(dir, '404.html');
		res.writeHead(file ? 200 : 404, { 'content-type': types[extname(found)] ?? 'application/octet-stream' });
		res.end(existsSync(found) ? readFileSync(found) : 'Not found');
	});
	return new Promise((resolve) => {
		server.listen(port, '127.0.0.1', () => resolve({ server, port: server.address().port }));
	});
}

if (import.meta.url === `file://${process.argv[1]}`) {
	const { port } = await serve(join(process.cwd(), process.argv[2] ?? 'dist'), { port: Number(process.argv[3] ?? 4321), base: process.argv[4] ?? '' });
	console.log(`serving on http://127.0.0.1:${port}`);
}
