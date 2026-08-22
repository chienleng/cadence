// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
import type { WorkspaceLoadResult, WorkspaceSnapshot } from '$lib/workspace/types';

declare global {
	namespace App {
		// interface Error {}
		// interface Locals {}
		interface PageData {
			/** Root route (local mode or hosted landing). */
			hosted?: boolean;
			result?: WorkspaceLoadResult | null;
			/** Demo route. */
			workspace?: WorkspaceSnapshot;
		}
		// interface PageState {}
		// interface Platform {}
	}
}

export {};
