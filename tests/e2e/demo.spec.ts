import { test, expect } from '@playwright/test';
import { expectPageFits, selectRecord } from './helpers';

test('root route is the homepage and links to the fictional dashboard', async ({ page }) => {
	await page.goto('/');
	await expect(page.getByRole('heading', { name: /See every project clearly/ })).toBeVisible();
	await page.getByRole('link', { name: 'Explore the demo', exact: true }).click();
	await expect(page).toHaveURL('/demo');
});

test('built demo retains styling, table controls and fictional-only links', async ({ page }) => {
	await page.goto('/demo?view=table');
	await expect(page.locator('tbody tr')).toHaveCount(3);
	await expect(page.locator('.project-comparison')).toHaveCSS('border-top-style', 'solid');
	await expect(page.locator('.table-work-link')).toHaveCount(0);
	await page.locator('.table-commit summary').first().focus();
	await page.keyboard.press('Enter');
	await expect(page.locator('.table-commit[open]')).toHaveCount(1);
	await expectPageFits(page);
});

test('built demo record selection and filtered return survive reload', async ({ page }) => {
	await page.goto('/demo?q=Harbour&group=Products');
	await page.getByRole('link', { name: 'Open Harbour API project', exact: true }).click();
	await selectRecord(page, 'Keep project knowledge local-first', 'Decision');
	await page.reload();
	await expect(page.locator('.record-layout article')).toContainText(
		'Keep project knowledge local-first'
	);
	await expectPageFits(page);
	await page.getByRole('link', { name: 'Projects', exact: true }).click();
	await expect(page.locator('.result-count')).toHaveText('1 of 3 projects');
	expect(new URL(page.url()).pathname).toBe('/demo');
	expect(new URL(page.url()).searchParams.get('q')).toBe('Harbour');
});

test('built demo loads selected document bodies and preserves independent record selection', async ({
	page
}) => {
	const response = await page.goto('/demo/projects/harbour-api');
	expect(await response!.text()).not.toContain('preserve unrelated changes');
	await page
		.getByRole('navigation', { name: 'Markdown documents' })
		.getByRole('link', { name: 'Harbour API agent guide AGENTS.md', exact: true })
		.click();
	await expect(page.locator('.project-markdown').last()).toContainText(
		'preserve unrelated changes'
	);
	await selectRecord(page, 'Keep project knowledge local-first', 'Decision');
	await page.reload();
	await expect(page.locator('.project-markdown').last()).toContainText(
		'preserve unrelated changes'
	);
	await expect(page.locator('.record-layout article')).toContainText('Durable context remains');
	await page.goBack();
	await expect(page.locator('.record-layout article')).toContainText('Current status');
	await expectPageFits(page);
});
