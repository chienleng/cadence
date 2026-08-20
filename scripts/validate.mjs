#!/usr/bin/env node

import { access, readFile, readdir } from 'node:fs/promises';
import { dirname, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const appRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const lifecycles = new Set(['active', 'maintained', 'paused', 'dormant', 'unknown']);

async function exists(path) {
	try {
		await access(path);
		return true;
	} catch {
		return false;
	}
}

async function readJson(path, issues) {
	try {
		return JSON.parse(await readFile(path, 'utf8'));
	} catch {
		issues.push(`${path} is missing or is not valid JSON.`);
		return null;
	}
}

export async function validateDataRoot(root = process.env.CADENCE_DATA_ROOT) {
	const dataRoot = resolve(root ?? resolve(appRoot, '..', 'cadence-workspace'));
	const issues = [];
	const configPath = resolve(dataRoot, 'cadence.config.json');
	const config = await readJson(configPath, issues);
	if (
		config &&
		(config.schemaVersion !== 1 ||
			typeof config.name !== 'string' ||
			!config.name.trim() ||
			typeof config.workspaceRoot !== 'string' ||
			!config.workspaceRoot.trim())
	) {
		issues.push('cadence.config.json must contain schemaVersion 1, name, and workspaceRoot.');
	}

	const workspaceRoot = config?.workspaceRoot
		? resolve(dataRoot, config.workspaceRoot)
		: resolve(dataRoot, '..');
	if (config && !(await exists(workspaceRoot))) {
		issues.push(`Workspace root does not exist: ${workspaceRoot}`);
	}

	const projectsRoot = resolve(dataRoot, 'projects');
	const definitionPaths = [];
	async function visit(directory, depth) {
		if (depth > 12 || !(await exists(directory))) return;
		for (const entry of await readdir(directory, { withFileTypes: true })) {
			if (entry.isSymbolicLink() || entry.name.startsWith('.')) continue;
			const child = resolve(directory, entry.name);
			if (entry.isDirectory()) await visit(child, depth + 1);
			else if (entry.isFile() && entry.name === 'project.json') definitionPaths.push(child);
		}
	}
	await visit(projectsRoot, 0);

	const projects = [];
	const ids = new Set();
	for (const path of definitionPaths.sort()) {
		const project = await readJson(path, issues);
		if (!project) continue;
		const expectedPath = relative(projectsRoot, dirname(path)).split(sep).join('/');
		if (
			typeof project.path !== 'string' ||
			typeof project.name !== 'string' ||
			typeof project.group !== 'string' ||
			typeof project.summary !== 'string' ||
			!lifecycles.has(project.lifecycle)
		) {
			issues.push(`${relative(dataRoot, path)} is missing required project metadata.`);
			continue;
		}
		if (project.path !== expectedPath) {
			issues.push(
				`${relative(dataRoot, path)} declares path "${project.path}"; expected "${expectedPath}".`
			);
			continue;
		}
		const id = project.path
			.toLowerCase()
			.replace(/[^a-z0-9]+/g, '-')
			.replace(/^-|-$/g, '');
		if (ids.has(id)) issues.push(`Project paths produce duplicate URL id: ${id}`);
		ids.add(id);
		const source = resolve(workspaceRoot, project.path);
		const fromWorkspace = relative(workspaceRoot, source);
		if (fromWorkspace === '..' || fromWorkspace.startsWith(`..${sep}`)) {
			issues.push(`Project path escapes workspaceRoot: ${project.path}`);
		}
		projects.push(project);
	}

	return { valid: issues.length === 0, issues, dataRoot, workspaceRoot, config, projects };
}

if (fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
	const result = await validateDataRoot();
	if (!result.valid) {
		console.error(`Cadence data is invalid (${result.dataRoot}):`);
		for (const issue of result.issues) console.error(`- ${issue}`);
		process.exit(1);
	}
	console.log(
		`Cadence data is valid: ${result.projects.length} projects in ${result.config.name}.`
	);
}
