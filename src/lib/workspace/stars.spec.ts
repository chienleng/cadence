import { describe, expect, it } from 'vitest';
import {
	compareStarredProjects,
	readStarredProjectIds,
	starredProjectsStorageKey,
	toggleStarredProjectId,
	writeStarredProjectIds,
	type StarredProjectsStorage
} from './stars';

class MemoryStorage implements StarredProjectsStorage {
	items = new Map<string, string>();

	getItem(key: string): string | null {
		return this.items.get(key) ?? null;
	}

	setItem(key: string, value: string): void {
		this.items.set(key, value);
	}
}

describe('starred project persistence', () => {
	it('scopes storage keys by workspace mode and root', () => {
		const local = starredProjectsStorageKey({ mode: 'local', root: '/work/projects' });
		const demo = starredProjectsStorageKey({ mode: 'demo', root: '/work/projects' });
		expect(local).not.toBe(demo);
		expect(local).toBe(starredProjectsStorageKey({ mode: 'local', root: '/work/projects' }));
	});

	it('writes deterministic IDs and reads only projects in the current workspace', () => {
		const storage = new MemoryStorage();
		writeStarredProjectIds(storage, 'stars', ['tide-ui', 'harbour-api', 'tide-ui', 'removed']);
		expect(storage.getItem('stars')).toBe('["harbour-api","removed","tide-ui"]');
		expect(readStarredProjectIds(storage, 'stars', ['harbour-api', 'tide-ui'])).toEqual(
			new Set(['harbour-api', 'tide-ui'])
		);
	});

	it('treats malformed or inaccessible storage as empty', () => {
		const malformed = new MemoryStorage();
		malformed.setItem('stars', '{not json');
		expect(readStarredProjectIds(malformed, 'stars', ['harbour-api'])).toEqual(new Set());

		const unavailable: StarredProjectsStorage = {
			getItem: () => {
				throw new Error('blocked');
			},
			setItem: () => {
				throw new Error('blocked');
			}
		};
		expect(readStarredProjectIds(unavailable, 'stars', ['harbour-api'])).toEqual(new Set());
		expect(() => writeStarredProjectIds(unavailable, 'stars', ['harbour-api'])).not.toThrow();
	});
});

describe('starred project state', () => {
	it('toggles without mutating the current set', () => {
		const current = new Set(['harbour-api']);
		const removed = toggleStarredProjectId(current, 'harbour-api');
		const added = toggleStarredProjectId(removed, 'tide-ui');
		expect(current).toEqual(new Set(['harbour-api']));
		expect(removed).toEqual(new Set());
		expect(added).toEqual(new Set(['tide-ui']));
	});

	it('sorts starred projects before unstarred projects and ties otherwise', () => {
		const starred = new Set(['b']);
		expect(compareStarredProjects({ id: 'a' }, { id: 'b' }, starred)).toBeGreaterThan(0);
		expect(compareStarredProjects({ id: 'b' }, { id: 'a' }, starred)).toBeLessThan(0);
		expect(compareStarredProjects({ id: 'a' }, { id: 'c' }, starred)).toBe(0);
	});
});
