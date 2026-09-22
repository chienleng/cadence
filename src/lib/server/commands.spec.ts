import { describe, expect, it } from 'vitest';
import { count, errorText } from '../../../scripts/lib/commands.mjs';

describe('errorText', () => {
	it('keeps the last non-empty stderr line instead of the trailing blank', () => {
		const error = Object.assign(new Error('Command failed: gh repo view oztam/hawkeye-portal\n'), {
			stderr:
				"GraphQL: Could not resolve to a Repository with the name 'oztam/hawkeye-portal'. (repository)\n"
		});
		expect(errorText(error)).toBe(
			"GraphQL: Could not resolve to a Repository with the name 'oztam/hawkeye-portal'. (repository)"
		);
	});

	it('falls back to the message, then to a fixed phrase, and bounds the length', () => {
		expect(errorText(new Error('Command failed: git status\nfatal: not a git repository\n'))).toBe(
			'fatal: not a git repository'
		);
		expect(errorText(Object.assign(new Error('  \n'), { stderr: '\n\n' }))).toBe(
			'Command failed without output.'
		);
		expect(errorText('plain string')).toBe('plain string');
		expect(errorText(new Error('x'.repeat(500)))).toHaveLength(300);
	});
});

describe('count', () => {
	it('accepts only safe non-negative integers', () => {
		expect(count('3')).toBe(3);
		expect(count(' 0 ')).toBe(0);
		expect(count('')).toBeNull();
		expect(count('-1')).toBeNull();
		expect(count('1.5')).toBeNull();
		expect(count('abc')).toBeNull();
		expect(count(undefined)).toBeNull();
	});
});
