// Helpers for reading child-process results without losing information.

const MAX_ERROR_CHARS = 300;

/** The most useful line of a failed command: the last non-empty line of
 *  stderr when the error carries one, else of the error message. Node's
 *  execFile message is "Command failed: …\n<stderr>", and stderr usually
 *  ends with a newline, so taking the literal last line yields "".
 * @param {unknown} error */
export function errorText(error) {
	const candidates = [];
	if (error && typeof error === 'object') {
		const withStreams = /** @type {{ stderr?: unknown, message?: unknown }} */ (error);
		if (typeof withStreams.stderr === 'string') candidates.push(withStreams.stderr);
		if (typeof withStreams.message === 'string') candidates.push(withStreams.message);
	}
	if (!candidates.length) candidates.push(String(error));
	for (const text of candidates) {
		const line = text
			.split('\n')
			.map((item) => item.trim())
			.filter(Boolean)
			.at(-1);
		if (line) return line.slice(0, MAX_ERROR_CHARS);
	}
	return 'Command failed without output.';
}

/** A safe non-negative integer from command output, else null.
 * @param {unknown} value */
export function count(value) {
	const number = typeof value === 'string' ? Number(value.trim() || NaN) : value;
	return typeof number === 'number' && Number.isSafeInteger(number) && number >= 0 ? number : null;
}
