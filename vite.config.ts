import adapterCloudflare from '@sveltejs/adapter-cloudflare';
import adapterNode from '@sveltejs/adapter-node';
import { defineConfig } from 'vitest/config';
import { sveltekit } from '@sveltejs/kit/vite';
import { resolve } from 'node:path';

const demoMode = process.env.CADENCE_MODE === 'demo';

export default defineConfig({
	server: {
		host: 'cadence.localhost',
		port: 7613,
		strictPort: true
	},
	plugins: [
		sveltekit({
			alias: {
				'$workspace-provider': resolve(
					`src/lib/server/${demoMode ? 'demo-workspace' : 'local-workspace'}.ts`
				)
			},
			compilerOptions: {
				// Force runes mode for the project, except for libraries. Can be removed in svelte 6.
				runes: ({ filename }) =>
					filename.split(/[/\\]/).includes('node_modules') ? undefined : true
			},

			adapter: demoMode ? adapterCloudflare() : adapterNode()
		})
	],
	test: {
		expect: { requireAssertions: true },
		projects: [
			{
				extends: './vite.config.ts',
				test: {
					name: 'server',
					environment: 'node',
					include: ['src/**/*.{test,spec}.{js,ts}'],
					exclude: ['src/**/*.svelte.{test,spec}.{js,ts}']
				}
			}
		]
	}
});
