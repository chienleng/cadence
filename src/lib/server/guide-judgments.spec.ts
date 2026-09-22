import { describe, expect, it } from 'vitest';
import {
	buildGuideRequest,
	buildShimRequest,
	cachedGuideJudgment,
	guideExcerpts,
	judgeGuide
} from '../../../scripts/lib/guide-judgments.mjs';
import { statusHash } from '../../../scripts/lib/status-judgments.mjs';

const guide = [
	'# Project guide',
	'',
	'Read the README first.',
	'',
	'## Cadence context',
	'',
	'Before planning, run `pnpm --dir ../cadence context --cwd .`.',
	'',
	'```bash',
	'pnpm context --overview # inside a fence, ignored as a candidate',
	'```',
	'',
	'Unrelated section.',
	'',
	'Line about nothing.',
	'',
	'Line about nothing either.',
	'',
	'See the Cadence records for history.'
].join('\n');

describe('guideExcerpts', () => {
	it('windows around mentions outside code fences and merges overlaps', () => {
		const excerpts = guideExcerpts(guide);
		expect(excerpts.map((e) => e.line)).toEqual([3, 17]);
		expect(excerpts[0].text).toContain('## Cadence context');
		expect(excerpts[0].text).toContain('context --cwd');
		expect(excerpts[0].text).not.toContain('inside a fence');
		expect(excerpts[1].text).toContain('Cadence records');
	});

	it('returns nothing for guides that never mention Cadence', () => {
		expect(guideExcerpts('# Guide\n\nRun the tests.\n')).toEqual([]);
		expect(guideExcerpts(null)).toEqual([]);
	});
});

describe('requests', () => {
	it('asks one noul over the excerpts, and one over a shim', () => {
		const request = buildGuideRequest(guideExcerpts(guide));
		expect(Object.keys(request.questions)).toEqual(['instructs_context']);
		const state = request.state as { guide: { excerpts: { id: string }[] } };
		expect(state.guide.excerpts.map((e) => e.id)).toEqual(['E01', 'E02']);
		expect(Object.keys(buildShimRequest('@AGENTS.md\n').questions)).toEqual(['loads_guide']);
	});
});

describe('judgeGuide', () => {
	const client = (noul: number) => ({
		model: 'jev-test',
		async systemOne() {
			return {
				model: 'jev-1.13.0',
				answers: {
					instructs_context: { type: 'noul' as const, noul },
					loads_guide: { type: 'noul' as const, noul }
				},
				usage: { input_tokens: 50, output_tokens: 5 }
			};
		}
	});

	it('records the probability and excerpt count', async () => {
		const entry = await judgeGuide(guide, client(0.91));
		expect(entry).toMatchObject({ state: 'updated', instructs: 0.91, excerpts: 2 });
		expect(cachedGuideJudgment(entry, guide)).toBe(0.91);
		expect(cachedGuideJudgment(entry, `${guide}\n`)).toBeNull();
	});

	it('answers guides without a mention as not applicable and zero, without a request', async () => {
		const entry = await judgeGuide('# Guide\n', {
			model: 'jev-test',
			async systemOne() {
				throw new Error('must not be called');
			}
		});
		expect(entry).toMatchObject({ state: 'not-applicable', instructs: 0 });
		expect(cachedGuideJudgment(entry, '# Guide\n')).toBe(0);
	});

	it('judges a shim over its full text', async () => {
		const entry = await judgeGuide('@AGENTS.md\n', client(0.99), { kind: 'shim' });
		expect(entry).toMatchObject({ state: 'updated', instructs: 0.99, excerpts: 0 });
		expect(entry.sourceHash).toBe(statusHash('@AGENTS.md\n'));
	});

	it('turns failures into failed entries that the cache reader ignores', async () => {
		const entry = await judgeGuide(guide, {
			model: 'jev-test',
			async systemOne() {
				throw new Error('TypeSafe 500');
			}
		});
		expect(entry).toMatchObject({ state: 'failed', error: 'TypeSafe 500' });
		expect(cachedGuideJudgment(entry, guide)).toBeNull();
	});
});
