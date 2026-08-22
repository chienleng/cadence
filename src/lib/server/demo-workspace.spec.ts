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

	it('exercises the enriched dashboard fields', async () => {
		const result = await loadWorkspace();
		expect(result.state).toBe('ready');
		if (result.state !== 'ready') return;
		const { projects, summary } = result.workspace;
		expect(projects.every((project) => project.git.commitsByWeek.length === 12)).toBe(true);
		expect(projects.some((project) => project.github.state === 'ok')).toBe(true);
		expect(projects.some((project) => project.github.state === 'absent')).toBe(true);
		expect(projects.some((project) => project.status.stale)).toBe(true);
		expect(summary).toMatchObject({ behindUpstream: 1, staleStatus: 1 });
		expect(summary.openPullRequests).toBeGreaterThan(0);
	});

	it('supports the shared detail interface', async () => {
		const detail = await getProjectDetail('harbour-api');
		expect(detail?.records[0]?.path).toMatch(/^projects\//);
		expect(detail?.documents[0]?.html).toContain('<h1>');
	});
});
