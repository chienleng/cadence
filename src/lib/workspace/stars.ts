import type { WorkspaceSnapshot } from './types';

const STORAGE_KEY_PREFIX = 'cadence.starred-projects.v1';

export interface StarredProjectsStorage {
	getItem(key: string): string | null;
	setItem(key: string, value: string): void;
}

/** Keep stars isolated when the same Cadence origin is pointed at another workspace. */
export function starredProjectsStorageKey(
	workspace: Pick<WorkspaceSnapshot, 'mode' | 'root'>
): string {
	return `${STORAGE_KEY_PREFIX}:${encodeURIComponent(`${workspace.mode}:${workspace.root}`)}`;
}

/** Read only valid project IDs. Corrupt or unavailable storage behaves like an empty list. */
export function readStarredProjectIds(
	storage: StarredProjectsStorage,
	key: string,
	validProjectIds: Iterable<string>
): Set<string> {
	try {
		const raw = storage.getItem(key);
		if (!raw) return new Set();
		const value: unknown = JSON.parse(raw);
		if (!Array.isArray(value)) return new Set();
		const valid = new Set(validProjectIds);
		return new Set(
			value.filter((projectId): projectId is string => {
				return typeof projectId === 'string' && valid.has(projectId);
			})
		);
	} catch {
		return new Set();
	}
}

/** Persist a deterministic JSON array. Storage failures do not break the dashboard. */
export function writeStarredProjectIds(
	storage: StarredProjectsStorage,
	key: string,
	projectIds: Iterable<string>
): void {
	try {
		storage.setItem(key, JSON.stringify([...new Set(projectIds)].sort()));
	} catch {
		// The in-memory state remains usable when localStorage is blocked or full.
	}
}

export function toggleStarredProjectId(projectIds: Set<string>, projectId: string): Set<string> {
	const next = new Set(projectIds);
	if (next.has(projectId)) next.delete(projectId);
	else next.add(projectId);
	return next;
}

/** Negative when first should sort before second, positive when second should sort first. */
export function compareStarredProjects(
	first: { id: string },
	second: { id: string },
	starredProjectIds: ReadonlySet<string>
): number {
	return Number(starredProjectIds.has(second.id)) - Number(starredProjectIds.has(first.id));
}
