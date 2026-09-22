import { describe, expect, it } from 'vitest';
import { scanWorkspace } from '$lib/server/demo-workspace';
import { workspaceSummary } from './summary';

describe('workspaceSummary', () => {
	it('counts archived projects in total only', async () => {
		const { projects } = await scanWorkspace();
		const archived = { ...projects[1], id: 'old', lifecycle: 'archived' as const };
		const summary = workspaceSummary([...projects, archived]);
		expect(summary.total).toBe(projects.length + 1);
		expect(summary.archived).toBe(1);
		expect(summary.dirty).toBe(workspaceSummary(projects).dirty);
		expect(summary.openIssues).toBe(workspaceSummary(projects).openIssues);
	});
});
