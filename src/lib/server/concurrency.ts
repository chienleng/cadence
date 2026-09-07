/** A shared FIFO gate bounds work across requests, including failed operations. */
export function concurrencyLimit(maximum: number) {
	if (!Number.isInteger(maximum) || maximum < 1) throw new RangeError('Invalid concurrency');
	let active = 0;
	const waiting: (() => void)[] = [];
	return async function run<T>(operation: () => Promise<T>): Promise<T> {
		if (active >= maximum) await new Promise<void>((resolve) => waiting.push(resolve));
		else active++;
		try {
			return await operation();
		} finally {
			const next = waiting.shift();
			if (next) next();
			else active--;
		}
	};
}

/** Preserve input order without starting one promise chain per entry. */
export async function mapConcurrent<T, U>(
	values: T[],
	maximum: number,
	operation: (value: T) => Promise<U>
): Promise<U[]> {
	const results = new Array<U>(values.length);
	let next = 0;
	await Promise.all(
		Array.from({ length: Math.min(maximum, values.length) }, async () => {
			while (next < values.length) {
				const index = next++;
				results[index] = await operation(values[index]);
			}
		})
	);
	return results;
}
