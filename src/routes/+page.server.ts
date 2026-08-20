import { env } from '$env/dynamic/public';
import { loadWorkspace } from '$workspace-provider';

export async function load() {
	if (env.PUBLIC_CADENCE_MODE === 'demo') return { hosted: true as const, result: null };
	return { hosted: false as const, result: await loadWorkspace() };
}
