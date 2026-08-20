import { scanWorkspace } from '$workspace-provider';

export async function load() {
	return { workspace: await scanWorkspace() };
}
