#!/usr/bin/env node

// Compare cached Jev judgments with the exact-name STATUS.md convention so
// disagreements can be inspected one by one. Read-only: it consumes the
// refresh cache and the workspace records and prints a report.

import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateDataRoot } from './validate.mjs';
import { containedDirectory, readBoundedText, readMarkdown } from './lib/files.mjs';
import {
	cachedStatusJudgment,
	conventionalSection,
	rankBullets,
	statusCandidates
} from './lib/status-judgments.mjs';

const appRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const json = process.argv.includes('--json');

const validation = await validateDataRoot();
if (!validation.valid) {
	for (const issue of validation.issues) console.error(`- ${issue}`);
	process.exit(1);
}
const cacheRoot = resolve(process.env.CADENCE_CACHE_ROOT ?? resolve(appRoot, '.workspace-cache'));
const cache = await readBoundedText(
	cacheRoot,
	resolve(cacheRoot, 'projects.json'),
	8 * 1024 * 1024
);
if (!cache || cache.truncated) {
	console.error(
		'Refresh cache missing or oversized; run `pnpm refresh` with TYPESAFE_API_KEY set.'
	);
	process.exit(1);
}
const snapshot = JSON.parse(cache.text);
const byPath = new Map((snapshot.projects ?? []).map((project) => [project.path, project]));

/** @param {string | null} text */
function conventionalDate(text) {
	return text?.match(/^Updated:\s*(\d{4}-\d{2}-\d{2})$/m)?.[1] ?? null;
}

const rows = [];
for (const project of validation.projects) {
	const recordsRoot = await containedDirectory(
		validation.dataRoot,
		resolve(validation.dataRoot, 'projects', project.path)
	);
	const statusText = recordsRoot
		? await readMarkdown(recordsRoot, resolve(recordsRoot, 'STATUS.md'))
		: null;
	if (statusText === null) continue;
	const entry = byPath.get(project.path)?.judgments;
	const judgment = cachedStatusJudgment(entry, statusText);
	if (!judgment) {
		rows.push({
			path: project.path,
			state: entry?.state ?? 'missing',
			error: entry?.error ?? null
		});
		continue;
	}
	const candidates = statusCandidates(statusText);
	const headings = judgment.headings.map((heading) => ({
		text: heading.text,
		judged: heading.section,
		conventional: conventionalSection(heading.text),
		confidence: heading.confidence,
		deferred: heading.deferred,
		agrees: heading.section === conventionalSection(heading.text)
	}));
	const regexDate = conventionalDate(statusText);
	const ranked = rankBullets(judgment.sections.current).slice(0, 3);
	rows.push({
		path: project.path,
		state: 'judged',
		model: entry.model,
		latencyMs: entry.latencyMs,
		tokens: (entry.usage?.inputTokens ?? 0) + (entry.usage?.outputTokens ?? 0),
		questions: entry.questions,
		headings,
		disagreements: headings.filter((h) => !h.agrees).length,
		deferred: judgment.deferred,
		date: {
			conventional: regexDate,
			judged: judgment.updatedAt?.value ?? null,
			confidence: judgment.updatedAt?.confidence ?? null,
			agrees: regexDate === (judgment.updatedAt?.value ?? null)
		},
		parked: judgment.parked,
		topCurrent: ranked.map((b) => ({ score: b.score, text: b.text.slice(0, 90) })),
		documentOrderTop: judgment.sections.current.slice(0, 3).map((b) => b.id),
		rankedTop: ranked.map((b) => b.id),
		bulletCount: candidates.bullets.length
	});
}

if (json) {
	console.log(JSON.stringify(rows, null, 2));
	process.exit(0);
}
const judged = rows.filter((row) => row.state === 'judged');
console.log(`# Jev judgment report\n`);
console.log(
	`- Statuses: ${rows.length}; judged ${judged.length}; ${rows.length - judged.length} without a fresh judgment`
);
if (judged.length) {
	const totalTokens = judged.reduce((sum, row) => sum + row.tokens, 0);
	const totalLatency = judged.reduce((sum, row) => sum + row.latencyMs, 0);
	console.log(
		`- Model ${judged[0].model}; ${totalTokens} tokens, ${Math.round(totalLatency / judged.length)} ms mean per status`
	);
	const headingTotal = judged.reduce((sum, row) => sum + row.headings.length, 0);
	const headingDisagree = judged.reduce((sum, row) => sum + row.disagreements, 0);
	console.log(
		`- Headings: ${headingTotal} judged, ${headingDisagree} differ from the exact-name convention, ${judged.reduce((sum, row) => sum + row.deferred.length, 0)} deferred`
	);
	console.log(`- Dates: ${judged.filter((row) => row.date.agrees).length}/${judged.length} agree`);
	console.log(
		`- Order changed in top 3 Current items: ${judged.filter((row) => row.documentOrderTop.join() !== row.rankedTop.join()).length}`
	);
}
console.log('');
for (const row of rows) {
	if (row.state !== 'judged') {
		console.log(`## ${row.path} — ${row.state}${row.error ? `: ${row.error}` : ''}\n`);
		continue;
	}
	console.log(
		`## ${row.path} — ${row.latencyMs} ms, ${row.tokens} tokens, ${row.questions} questions\n`
	);
	for (const heading of row.headings)
		console.log(
			`- ${heading.agrees ? ' ' : '!'} "${heading.text}" → ${heading.judged} (convention ${heading.conventional}, confidence ${heading.confidence?.toFixed(2) ?? 'n/a'}${heading.deferred ? ', deferred' : ''})`
		);
	console.log(
		`- ${row.date.agrees ? ' ' : '!'} Updated: convention ${row.date.conventional ?? 'none'}, judged ${row.date.judged ?? 'none'} (${row.date.confidence?.toFixed(2) ?? 'n/a'})`
	);
	console.log(`-   Parked: ${row.parked?.toFixed(2) ?? 'n/a'}`);
	for (const item of row.topCurrent)
		console.log(
			`-   Current #${row.topCurrent.indexOf(item) + 1} (${item.score?.toFixed(2) ?? 'n/a'}): ${item.text}`
		);
	console.log('');
}
