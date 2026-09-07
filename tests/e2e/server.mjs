import { spawn, execFileSync } from 'node:child_process';
import { mkdtemp, mkdir, writeFile, rm, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

// This process owns this unique directory. Never derive cleanup paths from user configuration.
const root = await mkdtemp(join(tmpdir(), 'cadence-e2e-'));
const dataRoot = join(root, 'data');
const workspaceRoot = join(root, 'workspace');
const cacheRoot = join(root, 'cache');
const today = new Date().toISOString().slice(0, 10);
let server;
let stopping = false;
async function stop(code = 0) {
	if (stopping) return;
	stopping = true;
	server?.kill('SIGTERM');
	await rm(root, { recursive: true, force: true });
	process.exit(code);
}
process.on('SIGTERM', () => void stop());
process.on('SIGINT', () => void stop());
async function write(path, content) {
	await mkdir(resolve(path, '..'), { recursive: true });
	await writeFile(path, content);
}
try {
	await mkdir(workspaceRoot, { recursive: true });
	await write(
		join(dataRoot, 'cadence.config.json'),
		JSON.stringify({ schemaVersion: 1, name: 'Regression fixtures', workspaceRoot })
	);
	for (const name of ['harbour', 'failed', 'missing', 'empty']) {
		await write(
			join(dataRoot, 'projects', name, 'project.json'),
			JSON.stringify({
				path: name,
				name: name[0].toUpperCase() + name.slice(1),
				group: 'Products',
				summary: `Fictional project ${'long-content-'.repeat(15)}`,
				lifecycle: 'active',
				tags: ['api']
			})
		);
		if (name !== 'empty')
			await write(
				join(dataRoot, 'projects', name, 'STATUS.md'),
				`# ${name} status\n\nUpdated: ${today}\n\nSaved working context.`
			);
		if (name === 'missing' || name === 'empty') continue;
		const directory = join(workspaceRoot, name);
		await write(join(directory, 'README.md'), `# ${name} source documentation`);
		// All Git writes are confined to disposable test repositories; no network commands.
		const git = (...args) =>
			execFileSync('git', args, {
				cwd: directory,
				stdio: 'pipe',
				env: { ...process.env, GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: '/dev/null' }
			});
		git('init', '-b', 'main');
		git('config', 'user.name', 'Fixture');
		git('config', 'user.email', 'fixture@example.test');
		git('add', 'README.md');
		git('-c', 'commit.gpgsign=false', 'commit', '-m', `Fixture commit ${'longsubject'.repeat(45)}`);
		git('remote', 'add', 'origin', `https://github.com/cadence-fixtures/${name}.git`);
	}
	await write(
		join(dataRoot, 'projects/harbour/notes/ideas & café.md'),
		'# Saved café ideas\n\nKeep this record linkable.'
	);
	await write(
		join(dataRoot, 'projects/harbour/notes/large.md'),
		'# Large preview\n\n' + 'bounded '.repeat(80_000) + 'TAIL_SENTINEL'
	);
	await write(
		join(workspaceRoot, 'harbour/docs/café & notes.md'),
		'# Secondary source\n\n' + 'source '.repeat(2000) + '\nSELECTED_SOURCE_BODY'
	);
	await write(join(root, 'outside.md'), '# Outside record secret');
	await symlink(join(root, 'outside.md'), join(dataRoot, 'projects/harbour/notes/linked.md'));

	await write(
		join(cacheRoot, 'projects.json'),
		JSON.stringify({
			schemaVersion: 1,
			generatedAt: new Date().toISOString(),
			projects: [
				{
					path: 'harbour',
					github: { state: 'updated', issues: { totalCount: 0 }, pullRequests: { totalCount: 2 } }
				},
				{ path: 'failed', github: { state: 'failed', issues: { totalCount: 0 } } }
			]
		})
	);
	server = spawn(process.execPath, ['build'], {
		stdio: 'inherit',
		env: {
			...process.env,
			CADENCE_DATA_ROOT: dataRoot,
			CADENCE_CACHE_ROOT: cacheRoot,
			HOST: '127.0.0.1',
			PORT: '17613',
			ORIGIN: 'http://cadence.localhost:17613'
		}
	});
	server.on('error', (error) => {
		console.error(error);
		void stop(1);
	});
	server.on('exit', (code) => void stop(code ?? 1));
} catch (error) {
	console.error(error);
	await stop(1);
}
