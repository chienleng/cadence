import { demoMode } from '$cadence-mode';
import { loadWorkspace } from '$workspace-provider';

export async function load() {
	if (demoMode) return { hosted: true as const, result: null };
	return { hosted: false as const, result: await loadWorkspace() };
}
