import { redirect } from '@sveltejs/kit';
import { resolve } from '$app/paths';
import { demoMode } from '$cadence-mode';
import { loadWorkspace } from '$workspace-provider';

export async function load() {
	if (demoMode) redirect(307, resolve('/demo'));
	return { result: await loadWorkspace() };
}
