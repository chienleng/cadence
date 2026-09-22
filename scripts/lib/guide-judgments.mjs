// Jev (TypeSafe) judgments over agent guides for `pnpm context --audit`.
// The literal audit checks a marker comment and an exact command string; a
// guide can instruct agents perfectly well without either. Code finds the
// lines that mention Cadence or its context command, and Jev answers one
// narrow question over those excerpts: does the guide instruct agents to run
// the context command before substantial work? Guides with no candidate lines
// are answered "no" without a request.

import { JUDGMENT_SCHEMA_VERSION, statusHash } from './status-judgments.mjs';

/** Lines worth showing the model, with this much context either side. */
const EXCERPT_CONTEXT = 2;
const MAX_EXCERPTS = 40;
const MAX_SHIM_CHARS = 8_000;
const CANDIDATE = /cadence|context --cwd|pnpm context|context --overview/i;

/**
 * @typedef {{ id: string, line: number, text: string }} GuideExcerpt
 * @typedef {{ type: 'noul', noul: number }} NoulAnswer
 * @typedef {{ schemaVersion: number, generatedAt: string, sourceHash: string, model: string }} JudgmentBase
 * @typedef {JudgmentBase & ({ state: 'not-applicable', reason: string, instructs: 0 }
 *   | { state: 'failed', latencyMs: number, error: string }
 *   | { state: 'updated', latencyMs: number, usage: { inputTokens: number | null, outputTokens: number | null }, excerpts: number, instructs: number | null })} GuideJudgmentEntry
 */

/** @param {unknown} value */
function finite(value) {
	return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

/**
 * Windows of lines around every mention of Cadence or its commands, merged
 * when they overlap, outside fenced code.
 * @param {string | null | undefined} text
 * @returns {GuideExcerpt[]}
 */
export function guideExcerpts(text) {
	if (!text) return [];
	const lines = text.replace(/\r\n?/g, '\n').split('\n');
	/** @type {[number, number][]} */
	const windows = [];
	let fence = null;
	for (const [index, line] of lines.entries()) {
		const fenceMark = line.match(/^\s*(`{3,}|~{3,})/)?.[1];
		if (fenceMark) {
			fence = fence ? (fenceMark[0] === fence ? null : fence) : fenceMark[0];
			continue;
		}
		if (fence || !CANDIDATE.test(line)) continue;
		const start = Math.max(0, index - EXCERPT_CONTEXT);
		const end = Math.min(lines.length - 1, index + EXCERPT_CONTEXT);
		const last = windows.at(-1);
		if (last && start <= last[1] + 1) last[1] = end;
		else windows.push([start, end]);
	}
	return windows.slice(0, MAX_EXCERPTS).map(([start, end], index) => ({
		id: `E${String(index + 1).padStart(2, '0')}`,
		line: start + 1,
		text: lines.slice(start, end + 1).join('\n')
	}));
}

/** @param {GuideExcerpt[]} excerpts */
export function buildGuideRequest(excerpts) {
	return {
		state: {
			guide: {
				note: 'Excerpts from an AGENTS.md coding-agent guide, each a few lines around a mention of Cadence. Line numbers refer to the original file.',
				excerpts: excerpts.map(({ id, line, text }) => ({ id, line, text }))
			}
		},
		questions: {
			instructs_context: {
				type: 'noul',
				instructions:
					'Do these guide excerpts instruct coding agents to run the Cadence context command (for example `pnpm context --cwd`, `pnpm --dir <path>/cadence context --cwd .`, or a Cadence "context" command) before planning or making substantial changes in a project?',
				criteria: {
					true: 'An instruction, in the imperative or as a required step, tells agents to run a Cadence context command before planning, evaluating or changing a project; the exact wording, quoting and path may differ.',
					false:
						'Cadence is only described, linked, listed among projects, or mentioned in an example or a "do not" note; or the command is mentioned without telling agents to run it before work.'
				}
			}
		}
	};
}

/** @param {string} text */
export function buildShimRequest(text) {
	return {
		state: { file: text.slice(0, MAX_SHIM_CHARS) },
		questions: {
			loads_guide: {
				type: 'noul',
				instructions:
					'Does this vendor instruction file load or import the shared AGENTS.md guide so that its rules apply automatically, rather than merely mentioning or linking to it?',
				criteria: {
					true: 'The file contains an import or include directive for AGENTS.md (such as a line consisting of `@AGENTS.md`), or an equivalent statement that the guide is inlined or applied as these instructions.',
					false:
						'The file only points at AGENTS.md as something to read, describes it, or does not mention it.'
				}
			}
		}
	};
}

/**
 * Judge one guide; never throws for API failures. Guides with no candidate
 * lines are answered without a request.
 * @param {string} text
 * @param {{ systemOne: (request: { state: unknown, questions: Record<string, unknown> }) => Promise<{ model?: string, answers?: Record<string, NoulAnswer>, usage?: { input_tokens?: number, output_tokens?: number } }>, model: string }} client
 * @param {{ kind?: 'guide' | 'shim', now?: Date }} [options]
 * @returns {Promise<GuideJudgmentEntry>}
 */
export async function judgeGuide(text, client, { kind = 'guide', now = new Date() } = {}) {
	const base = {
		schemaVersion: JUDGMENT_SCHEMA_VERSION,
		generatedAt: now.toISOString(),
		sourceHash: statusHash(text),
		model: client.model
	};
	const excerpts = kind === 'guide' ? guideExcerpts(text) : [];
	if (kind === 'guide' && !excerpts.length)
		return { ...base, state: 'not-applicable', reason: 'No mention of Cadence.', instructs: 0 };
	const request = kind === 'guide' ? buildGuideRequest(excerpts) : buildShimRequest(text);
	const question = kind === 'guide' ? 'instructs_context' : 'loads_guide';
	const started = performance.now();
	try {
		const response = await client.systemOne(request);
		const answer = response.answers?.[question];
		return {
			...base,
			state: 'updated',
			model: response.model ?? client.model,
			latencyMs: Math.round(performance.now() - started),
			usage: {
				inputTokens: finite(response.usage?.input_tokens),
				outputTokens: finite(response.usage?.output_tokens)
			},
			excerpts: excerpts.length,
			instructs: answer?.type === 'noul' ? finite(answer.noul) : null
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
 * The cached probability, only when it was computed from this exact text.
 * @param {unknown} entry
 * @param {string | null} text
 * @returns {number | null}
 */
export function cachedGuideJudgment(entry, text) {
	if (!text || !entry || typeof entry !== 'object') return null;
	const raw = /** @type {Record<string, unknown>} */ (entry);
	if (raw.schemaVersion !== JUDGMENT_SCHEMA_VERSION || raw.sourceHash !== statusHash(text))
		return null;
	if (raw.state !== 'updated' && raw.state !== 'not-applicable') return null;
	return finite(raw.instructs);
}
