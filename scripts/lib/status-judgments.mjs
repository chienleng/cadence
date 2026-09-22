// TypeSafe (Jev) judgments over STATUS.md, computed by `pnpm refresh` and
// cached; `pnpm context` and the app only read the cached answers, so they
// stay deterministic and offline. Code finds candidates (headings, bullets,
// date spans) and Jev selects or scores them: it never generates text.
// See docs/commands.md and the 2026-09-22 workspace decision.

import { createHash } from 'node:crypto';

export const JUDGMENT_SCHEMA_VERSION = 1;
export const DEFAULT_MODEL = 'jev-latest';
export const DEFAULT_ENDPOINT = 'https://api.typesafe.ai/v1/systemone';
/** Below this confidence a judgment defers to the regex convention. */
export const CONFIDENCE_THRESHOLD = 0.6;
/** A Choice accepts at most 255 options; keep one spare for "none". */
const MAX_DATE_CANDIDATES = 254;
const MAX_BULLETS = 120;
const MAX_HEADINGS = 40;
const SECTION_NAMES = /** @type {const} */ (['current', 'next', 'risks']);

/**
 * @typedef {'current' | 'next' | 'risks'} SectionName
 * @typedef {{ id: string, level: number, text: string, line: number }} HeadingCandidate
 * @typedef {{ id: string, heading: string | null, text: string, line: number }} BulletCandidate
 * @typedef {{ id: string, value: string, context: string, line: number }} DateCandidate
 * @typedef {{ headings: HeadingCandidate[], bullets: BulletCandidate[], dates: DateCandidate[] }} StatusCandidates
 * @typedef {{ type: 'choice', choice: string, probabilities: Record<string, number>, confidence: number }} ChoiceAnswer
 * @typedef {{ type: 'score', score: number, legend: Record<string, string>, probabilities: Record<string, number>, confidence: number }} ScoreAnswer
 * @typedef {{ type: 'noul', noul: number }} NoulAnswer
 * @typedef {ChoiceAnswer | ScoreAnswer | NoulAnswer} Answer
 * @typedef {{ model: string, answers: Record<string, Answer>, usage?: { input_tokens?: number, output_tokens?: number } }} SystemOneResponse
 * @typedef {{ id: string, text: string, section: SectionName | 'other', confidence: number | null, deferred: boolean }} HeadingJudgment
 * @typedef {{ id: string, text: string, score: number | null, confidence: number | null }} BulletJudgment
 * @typedef {{
 *   sections: Record<SectionName, BulletJudgment[]>,
 *   headings: HeadingJudgment[],
 *   updatedAt: { value: string, confidence: number } | null,
 *   parked: number | null,
 *   deferred: string[]
 * }} StatusJudgment
 * @typedef {{ schemaVersion: number, generatedAt: string, sourceHash: string, model: string }} JudgmentBase
 * @typedef {JudgmentBase & ({ state: 'not-applicable', reason: string }
 *   | { state: 'failed', latencyMs: number, error: string }
 *   | { state: 'updated', latencyMs: number, usage: { inputTokens: number | null, outputTokens: number | null }, questions: number, status: StatusJudgment })} JudgmentEntry
 */

/** @param {number} index @param {string} prefix */
function candidateId(prefix, index) {
	return `${prefix}${String(index + 1).padStart(2, '0')}`;
}

/** @param {string} text */
export function statusHash(text) {
	return createHash('sha256').update(text).digest('hex');
}

/**
 * Over-find section headings (##), list items and date spans outside fenced
 * code. CRLF and trailing whitespace are tolerated; continuation lines join
 * their bullet; ###+ sub-headings do not start a new section.
 * @param {string | null | undefined} statusText
 * @returns {StatusCandidates}
 */
export function statusCandidates(statusText) {
	/** @type {StatusCandidates} */
	const candidates = { headings: [], bullets: [], dates: [] };
	if (!statusText) return candidates;
	const lines = statusText.replace(/\r\n?/g, '\n').split('\n');
	let fence = null;
	/** @type {HeadingCandidate | null} */
	let heading = null;
	/** @type {BulletCandidate | null} */
	let bullet = null;
	for (const [index, raw] of lines.entries()) {
		const line = raw.trimEnd();
		const fenceMark = line.match(/^\s*(`{3,}|~{3,})/)?.[1];
		if (fenceMark) {
			if (!fence) fence = fenceMark[0];
			else if (fenceMark[0] === fence) fence = null;
			bullet = null;
			continue;
		}
		if (fence) continue;
		const headingMatch = line.match(/^(#{1,6})\s+(.+?)\s*#*$/);
		if (headingMatch) {
			bullet = null;
			if (headingMatch[1].length === 1) {
				heading = null;
				continue;
			}
			// Sub-headings (###+) are topics inside a section, not sections:
			// their items stay with the nearest ## heading, as the convention
			// already treats them.
			if (headingMatch[1].length > 2) continue;
			if (candidates.headings.length >= MAX_HEADINGS) continue;
			heading = {
				id: candidateId('H', candidates.headings.length),
				level: headingMatch[1].length,
				text: headingMatch[2].trim(),
				line: index + 1
			};
			candidates.headings.push(heading);
			continue;
		}
		const bulletMatch = line.match(/^\s*(?:[-*+]|\d+[.)])\s+(.+)$/);
		if (bulletMatch) {
			bullet = null;
			if (candidates.bullets.length < MAX_BULLETS) {
				bullet = {
					id: candidateId('B', candidates.bullets.length),
					heading: heading?.id ?? null,
					text: bulletMatch[1].trim(),
					line: index + 1
				};
				candidates.bullets.push(bullet);
			}
		} else if (bullet && /^\s+\S/.test(raw)) {
			bullet.text = `${bullet.text} ${line.trim()}`;
		} else bullet = null;
		for (const match of line.matchAll(/(?<![\d-])(\d{4}-\d{2}-\d{2})(?![\d-])/g)) {
			if (candidates.dates.length >= MAX_DATE_CANDIDATES) break;
			candidates.dates.push({
				id: candidateId('D', candidates.dates.length),
				value: match[1],
				context: line.trim(),
				line: index + 1
			});
		}
	}
	return candidates;
}

const sectionCriteria = {
	current: {
		what: 'The section describing what is true now: work in progress, recently completed, released or verified, and the present state of the project.',
		examples: ['Current', 'Current work', 'Now', 'State of play', 'Recent progress']
	},
	next: {
		what: 'The section listing planned follow-ups, next steps, open tasks or what to pick up next.',
		examples: ['Next', 'Next steps', "What's next", 'Follow-ups', 'Up next']
	},
	risks: {
		what: 'The section listing hazards, constraints, caveats or things that could go wrong.',
		examples: ['Risks', 'Risks and mitigations', 'Caveats', 'Constraints', 'Known hazards']
	},
	other: {
		what: 'Any other section: related records, history, links, background, verification notes, or a heading that names a topic rather than a status role.',
		examples: ['Related records', 'History', 'Links', 'Overview', 'Verification']
	}
};

const bulletLevels = [
	'Historical or completed: describes something already done, released, verified or decided, with nothing left to do.',
	'Background: a standing fact, constraint or description of the project that does not call for action.',
	'Open follow-up: a task, check or decision that someone could pick up in a coming session.',
	'Pressing: blocked, time-bound, awaiting verification of something already shipped, or required before the next release or session.'
];

/**
 * One request per status: every question sees the same candidate state and
 * runs in parallel. Bullet scores are speculative; code consumes only those
 * under Current and Next once headings are classified.
 * @param {StatusCandidates} candidates
 */
export function buildRequest(candidates) {
	/** @type {Record<string, unknown>} */
	const questions = {};
	for (const heading of candidates.headings) {
		questions[`section_${heading.id}`] = {
			type: 'choice',
			instructions: `Which STATUS role does heading \`status.headings[${heading.id}]\` ("${heading.text}") play, judged by its wording and the bullets listed under it?`,
			criteria: sectionCriteria
		};
	}
	for (const bullet of candidates.bullets) {
		questions[`bullet_${bullet.id}`] = {
			type: 'score',
			instructions: `How actionable is status item \`status.bullets[${bullet.id}]\` for the next working session on this project?`,
			criteria: bulletLevels
		};
	}
	if (candidates.dates.length) {
		/** @type {Record<string, unknown>} */
		const criteria = {};
		for (const date of candidates.dates)
			criteria[date.id] = {
				what: `${date.value}, found on line ${date.line}: "${date.context}"`
			};
		criteria.none = {
			what: 'None of these is the date the status as a whole was last updated; they are examples, historical entries or dates of other things.'
		};
		questions.updated_date = {
			type: 'choice',
			instructions:
				'Which date span records when this STATUS document as a whole was last updated (for example an "Updated:" line near the top), rather than a date inside an item, an example, or a history entry?',
			criteria
		};
	}
	if (candidates.bullets.length) {
		questions.parked = {
			type: 'noul',
			instructions:
				'Taken together, do the status items under the current-state section describe work that is finished, released, or deliberately parked, with nothing actively in progress?',
			criteria: {
				true: 'The latest items say the work is complete, released, verified, or parked until later, and nothing is described as underway.',
				false:
					'Something is described as in progress, partially done, uncommitted, or actively being worked on.'
			}
		};
	}
	return {
		state: {
			status: {
				headings: candidates.headings.map(({ id, level, text }) => ({
					id,
					level,
					text,
					bullets: candidates.bullets.filter((b) => b.heading === id).map((b) => b.id)
				})),
				bullets: Object.fromEntries(candidates.bullets.map((b) => [b.id, b.text])),
				dates: candidates.dates.map(({ id, value, line, context }) => ({
					id,
					value,
					line,
					context
				}))
			}
		},
		questions
	};
}

/** Exact-name convention, kept as the fallback for low-confidence headings.
 * @param {string} text @returns {SectionName | 'other'} */
export function conventionalSection(text) {
	const name = text.trim().toLowerCase();
	return SECTION_NAMES.find((section) => section === name) ?? 'other';
}

/** @param {unknown} value */
function finite(value) {
	return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

/**
 * Compose answers into sections. Low-confidence heading choices defer to the
 * exact-name convention; bullets keep document order unless a score ranks them.
 * @param {StatusCandidates} candidates
 * @param {Record<string, Answer>} answers
 * @param {{ threshold?: number }} [options]
 * @returns {StatusJudgment}
 */
export function applyAnswers(candidates, answers, { threshold = CONFIDENCE_THRESHOLD } = {}) {
	/** @type {string[]} */
	const deferred = [];
	/** @type {HeadingJudgment[]} */
	const headings = candidates.headings.map((heading) => {
		const answer = answers[`section_${heading.id}`];
		const confidence = answer?.type === 'choice' ? finite(answer.confidence) : null;
		const chosen = answer?.type === 'choice' ? answer.choice : null;
		const valid = chosen === 'other' || SECTION_NAMES.some((s) => s === chosen);
		const defer = !valid || confidence === null || confidence < threshold;
		if (defer) deferred.push(heading.id);
		return {
			id: heading.id,
			text: heading.text,
			section: defer
				? conventionalSection(heading.text)
				: /** @type {SectionName | 'other'} */ (chosen),
			confidence,
			deferred: defer
		};
	});
	/** @type {Record<SectionName, BulletJudgment[]>} */
	const sections = { current: [], next: [], risks: [] };
	for (const bullet of candidates.bullets) {
		const heading = headings.find((h) => h.id === bullet.heading);
		if (!heading || heading.section === 'other') continue;
		const answer = answers[`bullet_${bullet.id}`];
		sections[heading.section].push({
			id: bullet.id,
			text: bullet.text,
			score: answer?.type === 'score' ? finite(answer.score) : null,
			confidence: answer?.type === 'score' ? finite(answer.confidence) : null
		});
	}
	const dateAnswer = answers.updated_date;
	let updatedAt = null;
	if (dateAnswer?.type === 'choice') {
		const confidence = finite(dateAnswer.confidence);
		const date = candidates.dates.find((d) => d.id === dateAnswer.choice);
		if (date && confidence !== null && confidence >= threshold)
			updatedAt = { value: date.value, confidence };
		else deferred.push('updated_date');
	}
	const parkedAnswer = answers.parked;
	return {
		sections,
		headings,
		updatedAt,
		parked: parkedAnswer?.type === 'noul' ? finite(parkedAnswer.noul) : null,
		deferred
	};
}

/** Order Current/Next bullets by actionability, keeping document order on ties.
 * @param {BulletJudgment[]} bullets */
export function rankBullets(bullets) {
	return bullets
		.map((bullet, index) => ({ bullet, index }))
		.sort((a, b) => (b.bullet.score ?? -1) - (a.bullet.score ?? -1) || a.index - b.index)
		.map(({ bullet }) => bullet);
}

/**
 * Minimal HTTP client: bearer auth, bounded timeout, backoff on throttling.
 * @param {{ apiKey: string, model?: string, endpoint?: string, fetch?: typeof globalThis.fetch, timeoutMs?: number, retries?: number }} options
 */
export function createTypeSafeClient({
	apiKey,
	model = DEFAULT_MODEL,
	endpoint = DEFAULT_ENDPOINT,
	fetch = globalThis.fetch,
	timeoutMs = 30_000,
	retries = 2
}) {
	if (!apiKey) throw new Error('TypeSafe API key is required');
	return {
		model,
		/** @param {{ state: unknown, questions: Record<string, unknown> }} request
		 * @returns {Promise<SystemOneResponse>} */
		async systemOne(request) {
			let attempt = 0;
			for (;;) {
				const response = await fetch(endpoint, {
					method: 'POST',
					headers: {
						authorization: `Bearer ${apiKey}`,
						'content-type': 'application/json'
					},
					body: JSON.stringify({ model, ...request }),
					signal: AbortSignal.timeout(timeoutMs)
				});
				if (response.ok) return /** @type {Promise<SystemOneResponse>} */ (response.json());
				const throttled = response.status === 429 || response.status === 529;
				if (throttled && attempt < retries) {
					await new Promise((done) => setTimeout(done, 500 * 2 ** attempt));
					attempt += 1;
					continue;
				}
				const detail = (await response.text().catch(() => '')).slice(0, 200);
				throw new Error(`TypeSafe ${response.status}${detail ? `: ${detail}` : ''}`);
			}
		}
	};
}

/**
 * Judge one STATUS.md. Returns a cache entry; never throws for API failures.
 * @param {string} statusText
 * @param {{ systemOne: (request: { state: unknown, questions: Record<string, unknown> }) => Promise<SystemOneResponse>, model: string }} client
 * @param {{ now?: Date, threshold?: number }} [options]
 * @returns {Promise<JudgmentEntry>}
 */
export async function judgeStatus(statusText, client, { now = new Date(), threshold } = {}) {
	const candidates = statusCandidates(statusText);
	const request = buildRequest(candidates);
	const base = {
		schemaVersion: JUDGMENT_SCHEMA_VERSION,
		generatedAt: now.toISOString(),
		sourceHash: statusHash(statusText),
		model: client.model
	};
	if (!Object.keys(request.questions).length)
		return { ...base, state: 'not-applicable', reason: 'No headings, items or dates to judge.' };
	const started = performance.now();
	try {
		const response = await client.systemOne(request);
		return {
			...base,
			state: 'updated',
			model: response.model ?? client.model,
			latencyMs: Math.round(performance.now() - started),
			usage: {
				inputTokens: finite(response.usage?.input_tokens),
				outputTokens: finite(response.usage?.output_tokens)
			},
			questions: Object.keys(request.questions).length,
			status: applyAnswers(candidates, response.answers ?? {}, { threshold })
		};
	} catch (error) {
		return {
			...base,
			state: 'failed',
			latencyMs: Math.round(performance.now() - started),
			error: error instanceof Error ? error.message : String(error)
		};
	}
}

/**
 * Accept a cached judgment only when it was computed from this exact text.
 * @param {unknown} judgments
 * @param {string | null} statusText
 * @returns {StatusJudgment | null}
 */
export function cachedStatusJudgment(judgments, statusText) {
	if (!statusText || !judgments || typeof judgments !== 'object') return null;
	const entry = /** @type {Record<string, unknown>} */ (judgments);
	if (entry.schemaVersion !== JUDGMENT_SCHEMA_VERSION || entry.state !== 'updated') return null;
	if (entry.sourceHash !== statusHash(statusText)) return null;
	const status = entry.status;
	if (!status || typeof status !== 'object' || !('sections' in status)) return null;
	return /** @type {StatusJudgment} */ (status);
}
