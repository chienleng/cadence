import { describe, expect, it } from 'vitest';
import {
	applyAnswers,
	buildRequest,
	cachedStatusJudgment,
	createTypeSafeClient,
	judgeStatus,
	rankBullets,
	statusCandidates,
	statusHash
} from '../../../scripts/lib/status-judgments.mjs';

const messyStatus = [
	'# Harbour status',
	'',
	'Updated: 2026-09-20 ',
	'',
	'## Current work',
	'',
	'* Released 1.2.0 on 2026-09-18 and verified the deploy.',
	'* Migration of the booking table is half done;',
	'  the second half is uncommitted.',
	'',
	'```md',
	'## Current',
	'- Example bullet inside a fence, dated 2026-01-01.',
	'```',
	'',
	"## What's next",
	'',
	'1. Confirm the Cloudflare deploy of 1.2.0.',
	'2. Finish the migration before the next release.',
	'',
	'## Risks and mitigations',
	'',
	'+ Production holds real data.',
	'',
	'## History',
	'',
	'- 2026-08-01 first release.'
].join('\r\n');

function choice(pick: string, confidence = 0.9) {
	return {
		type: 'choice' as const,
		choice: pick,
		probabilities: { [pick]: confidence },
		confidence
	};
}

function score(value: number, confidence = 0.8) {
	return { type: 'score' as const, score: value, legend: {}, probabilities: {}, confidence };
}

describe('statusCandidates', () => {
	it('finds headings, tolerant bullets and dates outside code fences on CRLF text', () => {
		const candidates = statusCandidates(messyStatus);
		expect(candidates.headings.map((h) => h.text)).toEqual([
			'Current work',
			"What's next",
			'Risks and mitigations',
			'History'
		]);
		expect(candidates.bullets.map((b) => b.text)).toEqual([
			'Released 1.2.0 on 2026-09-18 and verified the deploy.',
			'Migration of the booking table is half done; the second half is uncommitted.',
			'Confirm the Cloudflare deploy of 1.2.0.',
			'Finish the migration before the next release.',
			'Production holds real data.',
			'2026-08-01 first release.'
		]);
		expect(candidates.bullets.map((b) => b.heading)).toEqual([
			'H01',
			'H01',
			'H02',
			'H02',
			'H03',
			'H04'
		]);
		expect(candidates.dates.map((d) => d.value)).toEqual([
			'2026-09-20',
			'2026-09-18',
			'2026-08-01'
		]);
		expect(candidates.dates[0].line).toBe(3);
	});

	it('keeps items under a sub-heading with the enclosing section', () => {
		const candidates = statusCandidates(
			'## Current\n\n- a\n\n### Release 1.0 — 2026-09-22\n\n- b\n\n#### Deeper\n\n- c\n\n## Next\n\n- d\n'
		);
		expect(candidates.headings.map((h) => h.text)).toEqual(['Current', 'Next']);
		expect(candidates.bullets.map((b) => [b.text, b.heading])).toEqual([
			['a', 'H01'],
			['b', 'H01'],
			['c', 'H01'],
			['d', 'H02']
		]);
	});

	it('returns nothing for empty input', () => {
		expect(statusCandidates(null)).toEqual({ headings: [], bullets: [], dates: [] });
	});
});

describe('buildRequest', () => {
	it('asks one section choice per heading, one score per bullet, a date choice and a parked noul', () => {
		const request = buildRequest(statusCandidates(messyStatus));
		const keys = Object.keys(request.questions);
		expect(keys.filter((k) => k.startsWith('section_'))).toHaveLength(4);
		expect(keys.filter((k) => k.startsWith('bullet_'))).toHaveLength(6);
		expect(keys).toContain('updated_date');
		expect(keys).toContain('parked');
		const date = request.questions.updated_date as { criteria: Record<string, unknown> };
		expect(Object.keys(date.criteria)).toEqual(['D01', 'D02', 'D03', 'none']);
		const state = request.state as { status: { bullets: Record<string, string> } };
		expect(state.status.bullets.B02).toContain('uncommitted');
	});

	it('asks nothing for a status with no candidates', () => {
		expect(Object.keys(buildRequest(statusCandidates('Just prose.')).questions)).toEqual([]);
	});
});

describe('applyAnswers', () => {
	const candidates = statusCandidates(messyStatus);

	it('routes bullets to judged sections and picks the judged date', () => {
		const judgment = applyAnswers(candidates, {
			section_H01: choice('current'),
			section_H02: choice('next'),
			section_H03: choice('risks'),
			section_H04: choice('other'),
			bullet_B01: score(0.2),
			bullet_B02: score(2.9),
			updated_date: choice('D01'),
			parked: { type: 'noul', noul: 0.1 }
		});
		expect(judgment.sections.current.map((b) => b.id)).toEqual(['B01', 'B02']);
		expect(judgment.sections.next.map((b) => b.id)).toEqual(['B03', 'B04']);
		expect(judgment.sections.risks.map((b) => b.id)).toEqual(['B05']);
		expect(judgment.updatedAt).toEqual({ value: '2026-09-20', confidence: 0.9 });
		expect(judgment.parked).toBe(0.1);
		expect(judgment.deferred).toEqual([]);
		expect(rankBullets(judgment.sections.current).map((b) => b.id)).toEqual(['B02', 'B01']);
	});

	it('defers low-confidence or invalid answers to the exact-name convention', () => {
		const plain = statusCandidates('## Current\n- a\n\n## Next\n- b\n\nUpdated: 2026-09-01\n');
		const judgment = applyAnswers(plain, {
			section_H01: choice('other', 0.3),
			section_H02: choice('bogus'),
			updated_date: choice('D01', 0.2)
		});
		expect(judgment.headings.map((h) => [h.section, h.deferred])).toEqual([
			['current', true],
			['next', true]
		]);
		expect(judgment.sections.current.map((b) => b.text)).toEqual(['a']);
		expect(judgment.updatedAt).toBeNull();
		expect(judgment.deferred).toEqual(['H01', 'H02', 'updated_date']);
	});

	it('keeps document order for unscored bullets', () => {
		const bullets = [
			{ id: 'B01', text: 'a', score: null, confidence: null },
			{ id: 'B02', text: 'b', score: 1, confidence: 0.5 },
			{ id: 'B03', text: 'c', score: null, confidence: null }
		];
		expect(rankBullets(bullets).map((b) => b.id)).toEqual(['B02', 'B01', 'B03']);
	});
});

describe('judgeStatus', () => {
	it('records model, usage, latency and the composed judgment', async () => {
		const seen: unknown[] = [];
		const client = {
			model: 'jev-test',
			async systemOne(request: { questions: Record<string, unknown> }) {
				seen.push(request);
				return {
					model: 'jev-1.13.0',
					answers: { section_H01: choice('current'), parked: { type: 'noul' as const, noul: 0.9 } },
					usage: { input_tokens: 120, output_tokens: 30 }
				};
			}
		};
		const entry = await judgeStatus('## Current\n- Done.\n', client, {
			now: new Date('2026-09-22T00:00:00Z')
		});
		expect(seen).toHaveLength(1);
		expect(entry).toMatchObject({
			schemaVersion: 1,
			state: 'updated',
			model: 'jev-1.13.0',
			generatedAt: '2026-09-22T00:00:00.000Z',
			sourceHash: statusHash('## Current\n- Done.\n'),
			usage: { inputTokens: 120, outputTokens: 30 },
			questions: 3
		});
		if (entry.state !== 'updated') throw new Error(`unexpected state ${entry.state}`);
		expect(entry.status.parked).toBe(0.9);
		expect(entry.status.sections.current.map((b) => b.text)).toEqual(['Done.']);
	});

	it('turns an API failure into a failed entry instead of throwing', async () => {
		const client = {
			model: 'jev-test',
			async systemOne() {
				throw new Error('TypeSafe 401: bad key');
			}
		};
		const entry = await judgeStatus('## Current\n- Done.\n', client);
		expect(entry).toMatchObject({ state: 'failed', error: 'TypeSafe 401: bad key' });
	});

	it('marks a status with nothing to judge as not applicable', async () => {
		const client = {
			model: 'jev-test',
			async systemOne() {
				throw new Error('should not be called');
			}
		};
		const entry = await judgeStatus('Prose only.', client);
		expect(entry.state).toBe('not-applicable');
	});
});

describe('cachedStatusJudgment', () => {
	const text = '## Current\n- a\n';
	const status = {
		sections: { current: [], next: [], risks: [] },
		headings: [],
		updatedAt: null,
		parked: null,
		deferred: []
	};

	it('accepts an updated entry whose hash matches the current text', () => {
		const entry = { schemaVersion: 1, state: 'updated', sourceHash: statusHash(text), status };
		expect(cachedStatusJudgment(entry, text)).toBe(status);
	});

	it('rejects stale, failed, malformed or mismatched entries', () => {
		const good = { schemaVersion: 1, state: 'updated', sourceHash: statusHash(text), status };
		expect(cachedStatusJudgment({ ...good, sourceHash: 'x' }, text)).toBeNull();
		expect(cachedStatusJudgment({ ...good, state: 'failed' }, text)).toBeNull();
		expect(cachedStatusJudgment({ ...good, schemaVersion: 2 }, text)).toBeNull();
		expect(cachedStatusJudgment({ ...good, status: null }, text)).toBeNull();
		expect(cachedStatusJudgment(good, null)).toBeNull();
		expect(cachedStatusJudgment(undefined, text)).toBeNull();
	});
});

describe('createTypeSafeClient', () => {
	it('sends a bearer request and retries throttled responses with backoff', async () => {
		const calls: { url: string; init: RequestInit }[] = [];
		let attempt = 0;
		const fetch = (async (url: string | URL | Request, init?: RequestInit) => {
			calls.push({ url: String(url), init: init ?? {} });
			attempt += 1;
			if (attempt === 1) return new Response('slow down', { status: 429 });
			return Response.json({ model: 'jev-1.13.0', answers: {} });
		}) as typeof globalThis.fetch;
		const client = createTypeSafeClient({ apiKey: 'k', fetch, model: 'jev-latest' });
		const response = await client.systemOne({ state: {}, questions: {} });
		expect(response.model).toBe('jev-1.13.0');
		expect(calls).toHaveLength(2);
		expect(calls[0].url).toBe('https://api.typesafe.ai/v1/systemone');
		const headers = calls[0].init.headers as Record<string, string>;
		expect(headers.authorization).toBe('Bearer k');
		expect(JSON.parse(String(calls[0].init.body))).toEqual({
			model: 'jev-latest',
			state: {},
			questions: {}
		});
	});

	it('throws with the status and a bounded body on other failures', async () => {
		const fetch = (async () =>
			new Response('bad key', { status: 401 })) as unknown as typeof globalThis.fetch;
		const client = createTypeSafeClient({ apiKey: 'k', fetch });
		await expect(client.systemOne({ state: {}, questions: {} })).rejects.toThrow(
			'TypeSafe 401: bad key'
		);
	});

	it('requires an API key', () => {
		expect(() => createTypeSafeClient({ apiKey: '' })).toThrow('API key');
	});
});
