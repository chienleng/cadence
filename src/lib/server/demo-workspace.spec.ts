import { describe, expect, it } from 'vitest';
import { getProjectDetail, loadWorkspace } from './demo-workspace';

describe('demo workspace provider', () => {
	it('provides only normalized fictional data', async () => {
		const result = await loadWorkspace();
		expect(result.state).toBe('ready');
		if (result.state !== 'ready') return;
		expect(result.workspace.mode).toBe('demo');
		expect(result.workspace.name).toBe('Northstar Studio');
		expect(result.workspace.projects.every((project) => project.git.remoteUrl === null)).toBe(true);
	});

	it('supports the shared detail interface', async () => {
		const detail = await getProjectDetail('harbour-api');
		expect(detail?.records[0]?.path).toMatch(/^projects\//);
		expect(detail?.documents[0]?.html).toContain('<h1>');
	});
});
