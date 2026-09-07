import { expect, type Page } from '@playwright/test';

export async function expectPageFits(page: Page) {
	await expect
		.poll(() => page.evaluate(() => document.documentElement.scrollWidth))
		.toBeLessThanOrEqual(page.viewportSize()!.width);
}

export async function selectRecord(page: Page, title: string, kind: string) {
	if (page.viewportSize()!.width <= 700) {
		await page.getByRole('combobox', { name: 'Project record', exact: true }).click();
		await page.getByRole('option', { name: `${kind} · ${title}`, exact: true }).click();
	} else {
		await page
			.getByRole('navigation', { name: 'Project workflow records' })
			.getByRole('link', { name: `${title} ${kind}`, exact: true })
			.click();
	}
	await expect(page.locator('.record-layout article')).toContainText(title);
}
