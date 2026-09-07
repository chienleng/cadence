import { test, expect } from '@playwright/test';
import { expectPageFits, selectRecord } from './helpers';

test('homepage is the root route and opens the project dashboard', async ({ page }) => {
	await page.goto('/');
	await expect(page.getByRole('heading', { name: /See every project clearly/ })).toBeVisible();
	await page.getByRole('link', { name: 'Open projects', exact: true }).click();
	await expect(page).toHaveURL('/projects');
	await expect(page.locator('.project-card')).toHaveCount(4);
	await page.getByRole('link', { name: 'Cadence home', exact: true }).click();
	await expect(page).toHaveURL('/');
});

test('direct loads retain styles and long-content card reflow', async ({ page }) => {
	await page.goto('/projects');
	await expect(page.locator('.project-card')).toHaveCount(4);
	await expect(page.locator('.project-card').first()).toHaveCSS('border-top-style', 'solid');
	await expectPageFits(page);
	await page.getByRole('link', { name: 'Open Harbour project', exact: true }).click();
	await expect(page.getByRole('heading', { name: 'harbour status', exact: true })).toBeVisible();
	await page.reload();
	await expect(page.locator('.detail-grid > *').first()).toHaveCSS('border-top-style', 'solid');
	await expectPageFits(page);
});

test('search and reset keep results first and preserve table view', async ({ page }) => {
	await page.goto('/projects?view=table');
	if (page.viewportSize()!.width <= 700)
		await page.getByRole('button', { name: /Filters/ }).click();
	const filters =
		page.viewportSize()!.width <= 700
			? page.getByRole('dialog', { name: 'Filters' })
			: page.getByRole('complementary');
	await filters.getByPlaceholder('Search projects…').fill('Harbour');
	await expect(page).toHaveURL(/q=Harbour/);
	if (page.viewportSize()!.width <= 700) await page.keyboard.press('Escape');
	await expect(page.locator('.result-count')).toHaveText('1 of 4 projects');
	await expect(page.locator('.workspace-overview')).not.toHaveAttribute('open');
	await page
		.locator('.active-filters')
		.getByRole('button', { name: 'Reset filters', exact: true })
		.click();
	await expect(page.locator('.result-count')).toHaveText('4 of 4 projects');
	expect(new URL(page.url()).searchParams.get('view')).toBe('table');
	await expect(page.locator('tbody tr')).toHaveCount(4);
});

test('record links survive reload and history and retain return context', async ({ page }) => {
	await page.goto('/projects?q=Harbour&group=Products&lifecycle=active&tag=api&view=table');
	await page.locator('tbody .row-link a').click();
	await selectRecord(page, 'Saved café ideas', 'Note');
	await expect(page.locator('.record-layout article')).toContainText('Saved café ideas');
	expect(new URL(page.url()).searchParams.get('record')).toBe(
		'projects/harbour/notes/ideas & café.md'
	);
	await page.reload();
	await expect(page.locator('.record-layout article')).toContainText('Saved café ideas');
	await page.goBack();
	await expect(page.locator('.record-layout article')).toContainText('harbour status');
	await page.goForward();
	await expect(page.locator('.record-layout article')).toContainText('Saved café ideas');
	await page.getByRole('link', { name: 'Projects', exact: true }).click();
	await expect(page.locator('.result-count')).toHaveText('1 of 4 projects');
	expect(Object.fromEntries(new URL(page.url()).searchParams)).toEqual({
		q: 'Harbour',
		group: 'Products',
		lifecycle: 'active',
		tag: 'api',
		view: 'table'
	});
});

test('missing checkouts and empty records remain accessible; unknown IDs do not', async ({
	page
}) => {
	await page.goto('/projects/missing');
	await expect(page.locator('p[role=status]')).toContainText('Source folder unavailable');
	await expect(page.locator('.record-layout article')).toContainText('missing status');
	await expect(page.getByText('Convention checks unavailable', { exact: true })).toBeVisible();
	await expectPageFits(page);
	await page.goto('/projects/empty');
	await expect(page.getByText('No status or work records', { exact: true })).toBeVisible();
	const response = await page.goto('/projects/unregistered');
	expect(response?.status()).toBe(404);
});

test('table distinguishes failed data, links zero counts and supports keyboard messages and stars', async ({
	page
}) => {
	await page.goto('/projects?view=table');
	const harbour = page
		.locator('tbody tr')
		.filter({ has: page.getByRole('link', { name: 'Harbour', exact: true }) });
	const failed = page
		.locator('tbody tr')
		.filter({ has: page.getByRole('link', { name: 'Failed', exact: true }) });
	await expect(failed).toContainText('GitHub refresh failed');
	await expect(failed.locator('.table-work-link')).toHaveCount(0);
	await expect(failed.locator('td').nth(3)).toHaveText('—');
	await expect(harbour.getByRole('link', { name: /0 cached open issues/ })).toHaveAttribute(
		'href',
		'https://github.com/cadence-fixtures/harbour/issues'
	);
	await expect(harbour.getByRole('link', { name: /2 cached open pull requests/ })).toHaveAttribute(
		'href',
		'https://github.com/cadence-fixtures/harbour/pulls'
	);
	const summary = harbour.getByText('Commit message', { exact: true });
	await summary.focus();
	await page.keyboard.press('Enter');
	await expect(harbour.locator('.table-commit')).toHaveAttribute('open');
	await expect(harbour.locator('.table-commit p')).toContainText('longsubject');
	await expectPageFits(page);
	await page.getByRole('button', { name: 'Star Failed', exact: true }).click();
	await expect(page.locator('tbody .row-link a').first()).toHaveText('Failed');
	await page.reload();
	await expect(page.getByRole('button', { name: 'Unstar Failed', exact: true })).toHaveAttribute(
		'aria-pressed',
		'true'
	);
});

test('unavailable record selections fall back visibly', async ({ page }) => {
	await page.goto('/projects/harbour?record=../../outside.md');
	await expect(page.locator('p[role=status]')).toContainText('This record is unavailable');
	await expect(page.locator('.record-layout article')).toContainText('harbour status');
});

test('oversized previews are labelled and linked records outside the boundary are omitted', async ({
	page
}) => {
	await page.goto('/projects/harbour');
	await selectRecord(page, 'Large preview', 'Note');
	await expect(page.locator('.record-layout article')).toContainText(
		'Preview truncated at 512 KiB.'
	);
	await expect(page.locator('.record-layout article')).not.toContainText('TAIL_SENTINEL');
	await expect(page.locator('main')).not.toContainText('Outside record secret');
	await expectPageFits(page);
});

test('document bodies load on selection with reload, history and independent record links', async ({
	page
}) => {
	const response = await page.goto('/projects/harbour?q=Harbour&view=table');
	const initial = await response!.text();
	expect(initial).not.toContain('SELECTED_SOURCE_BODY');
	expect(initial).not.toContain('bounded bounded bounded bounded');
	const documents = page.getByRole('navigation', { name: 'Markdown documents' });
	const secondary = documents.getByRole('link', {
		name: 'Secondary source docs/café & notes.md',
		exact: true
	});
	await secondary.focus();
	await page.keyboard.press('Enter');
	await expect(page.locator('.project-markdown').last()).toContainText('SELECTED_SOURCE_BODY');
	await expect(secondary).toHaveAttribute('aria-current', 'page');
	expect(new URL(page.url()).searchParams.get('document')).toBe('docs/café & notes.md');
	await selectRecord(page, 'Saved café ideas', 'Note');
	await expect(page.locator('.project-markdown').last()).toContainText('SELECTED_SOURCE_BODY');
	await page.reload();
	await expect(page.locator('.record-layout article')).toContainText('Keep this record linkable.');
	await expect(page.locator('.project-markdown').last()).toContainText('SELECTED_SOURCE_BODY');
	await page.goBack();
	await expect(page.locator('.record-layout article')).toContainText('harbour status');
	await page.goBack();
	await expect(page.locator('.project-markdown').last()).toContainText(
		'harbour source documentation'
	);
	await page.goForward();
	await expect(page.locator('.project-markdown').last()).toContainText('SELECTED_SOURCE_BODY');
	await expectPageFits(page);
	await page.getByRole('link', { name: 'Projects', exact: true }).click();
	await expect(page.locator('.result-count')).toHaveText('1 of 4 projects');
	expect(Object.fromEntries(new URL(page.url()).searchParams)).toEqual({
		q: 'Harbour',
		view: 'table'
	});
});

test('invalid document selections fall back to a known preview', async ({ page }) => {
	await page.goto('/projects/harbour?document=../../outside.md');
	await expect(page.locator('p[role=status]')).toContainText('This document is unavailable');
	await expect(page.locator('.project-markdown').last()).toContainText(
		'harbour source documentation'
	);
});

test('a slower earlier selection cannot replace the latest preview', async ({ page }) => {
	await page.goto('/projects/harbour');
	let release!: () => void;
	let finished!: () => void;
	let started!: () => void;
	const requested = new Promise<void>((resolve) => {
		started = resolve;
	});
	const gate = new Promise<void>((resolve) => {
		release = resolve;
	});
	const complete = new Promise<void>((resolve) => {
		finished = resolve;
	});
	await page.route('**/__data.json*', async (route) => {
		if (new URL(route.request().url()).searchParams.get('document') === 'docs/café & notes.md') {
			started();
			await gate;
			try {
				await route.continue();
			} finally {
				finished();
			}
		} else await route.continue();
	});
	try {
		const nav = page.getByRole('navigation', { name: 'Markdown documents' });
		await nav
			.getByRole('link', { name: 'Secondary source docs/café & notes.md', exact: true })
			.dispatchEvent('click');
		await requested;
		await expect(page.getByText('Loading preview…', { exact: true })).toBeVisible();
		await expect(page.locator('.detail-grid')).toHaveAttribute('aria-busy', 'true');
		await nav
			.getByRole('link', { name: 'harbour source documentation README.md', exact: true })
			.dispatchEvent('click');
		await expect(page).toHaveURL(/document=README.md/);
	} finally {
		release();
	}
	await complete;
	await expect(page.locator('.detail-grid')).toHaveAttribute('aria-busy', 'false');
	await expect(page.locator('.project-markdown').last()).toContainText(
		'harbour source documentation'
	);
	await expect(page.locator('.project-markdown').last()).not.toContainText('SELECTED_SOURCE_BODY');
});
