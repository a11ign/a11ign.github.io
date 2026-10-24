import { defineConfig } from '@playwright/test';

const PORT = 4323;

// `npm run check` builds the site first; this serves dist/ the way GitHub Pages does.
export default defineConfig({
	testDir: './tests',
	fullyParallel: true,
	timeout: 20_000,
	reporter: [['list']],
	use: { baseURL: `http://127.0.0.1:${PORT}` },
	webServer: {
		command: `node scripts/serve.mjs dist ${PORT}`,
		url: `http://127.0.0.1:${PORT}/`,
		reuseExistingServer: false,
	},
});
