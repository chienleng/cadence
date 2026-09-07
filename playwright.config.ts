import { defineConfig } from '@playwright/test';

const demo = process.env.CADENCE_E2E_MODE === 'demo';
const port = demo ? 17614 : 17613;

export default defineConfig({
	testDir: './tests/e2e',
	testMatch: [demo ? 'demo.spec.ts' : 'workspace.spec.ts', 'accessibility.spec.ts'],
	fullyParallel: true,
	forbidOnly: !!process.env.CI,
	retries: process.env.CI ? 1 : 0,
	workers: 2,
	reporter: [
		['list'],
		['html', { outputFolder: `playwright-report/${demo ? 'demo' : 'local'}`, open: 'never' }]
	],
	outputDir: `test-results/${demo ? 'demo' : 'local'}`,
	use: {
		baseURL: `http://cadence.localhost:${port}`,
		trace: 'retain-on-failure',
		screenshot: 'only-on-failure'
	},
	projects: [
		{ name: 'desktop', use: { browserName: 'chromium', viewport: { width: 1440, height: 1000 } } },
		{ name: 'mobile', use: { browserName: 'chromium', viewport: { width: 390, height: 844 } } }
	],
	webServer: {
		command: demo
			? 'pnpm exec wrangler dev .svelte-kit/cloudflare/_worker.js --ip 127.0.0.1 --port 17614 --inspector-port 17615'
			: 'node tests/e2e/server.mjs',
		url: `http://127.0.0.1:${port}${demo ? '/demo' : '/projects'}`,
		reuseExistingServer: false,
		gracefulShutdown: { signal: 'SIGTERM', timeout: 5000 },
		env: { WRANGLER_LOG: 'none' },
		timeout: 60_000
	}
});
