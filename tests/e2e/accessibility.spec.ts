import AxeBuilder from '@axe-core/playwright';
import { test, expect, type Page } from '@playwright/test';

const demo = process.env.CADENCE_E2E_MODE === 'demo';
const dashboard = demo ? '/demo' : '/projects';
const detail = `${demo ? '/demo' : ''}/projects/${demo ? 'harbour-api' : 'harbour'}`;

async function accessibilityScan(page: Page) {
	const result = await new AxeBuilder({ page })
		.withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa', 'best-practice'])
		.analyze();
	expect(
		result.violations.map(({ id, nodes }) => ({
			id,
			nodes: nodes.map(({ target, failureSummary }) => ({ target, failureSummary }))
		}))
	).toEqual([]);
}

test('dashboard, table, empty results and project previews pass automated accessibility checks', async ({
	page
}) => {
	await page.goto(dashboard);
	await accessibilityScan(page);
	await page.getByRole('radio', { name: 'Table', exact: true }).click();
	await expect(page.getByRole('radio', { name: 'Table', exact: true })).toHaveAttribute(
		'aria-checked',
		'true'
	);
	await accessibilityScan(page);
	await page.goto(`${dashboard}?q=no-project-matches-this`);
	await expect(page.getByText('No matching projects', { exact: true })).toBeVisible();
	await accessibilityScan(page);
	await page.goto(detail);
	await expect(
		page.getByText(
			'Ahead/behind compares locally known upstream refs. Cadence does not fetch or check the live remote.',
			{ exact: true }
		)
	).toBeVisible();
	await accessibilityScan(page);
});

test('filters support keyboard focus, result announcements and responsive modal isolation', async ({
	page
}) => {
	await page.goto(dashboard);
	const mobile = page.viewportSize()!.width <= 1000;
	const trigger = page.getByRole('button', { name: 'Filters', exact: true });
	let filters = page.getByRole('complementary');
	if (mobile) {
		// The closed mounted panel is inert, not merely translated off screen.
		await expect(page.locator('.su-sheet')).toHaveAttribute('inert', '');
		const cdp = await page.context().newCDPSession(page);
		const tree = await cdp.send('Accessibility.getFullAXTree');
		expect(
			tree.nodes.filter((node) => node.role?.value === 'dialog' && !node.ignored)
		).toHaveLength(0);
		await cdp.detach();
		await trigger.focus();
		await page.keyboard.press('Enter');
		filters = page.getByRole('dialog', { name: 'Filters' });
		await expect(filters).toHaveAttribute('aria-modal', 'true');
		await expect(page.locator('.app-main')).toHaveAttribute('inert', '');
		await expect
			.poll(() => filters.evaluate((node) => node.contains(document.activeElement)))
			.toBe(true);
		await filters.getByRole('button', { name: 'Close panel' }).focus();
		await page.keyboard.press('Shift+Tab');
		await expect
			.poll(() => filters.evaluate((node) => node.contains(document.activeElement)))
			.toBe(true);
		await page.keyboard.press('Tab');
		await expect
			.poll(() => filters.evaluate((node) => node.contains(document.activeElement)))
			.toBe(true);
	}
	await accessibilityScan(page);
	const search = filters.getByRole('searchbox', { name: 'Search projects…' });
	await search.fill('Harbour');
	await expect(page).toHaveURL(/q=Harbour/);
	await expect(search).toBeFocused();
	const results = mobile ? filters.getByRole('status') : page.locator('.result-count');
	await expect(results).toHaveText(`1 of ${demo ? 3 : 4} projects`);
	await expect(results).toHaveAttribute('aria-atomic', 'true');
	await accessibilityScan(page);
	if (mobile) {
		await page.keyboard.press('Escape');
		await expect(trigger).toBeFocused();
		await expect(trigger).toHaveAttribute('aria-expanded', 'false');
		await trigger.press('Enter');
		await page.setViewportSize({ width: 1440, height: 1000 });
		await expect(page.locator('.su-sheet')).toHaveAttribute('inert', '');
		await expect(page.locator('.app-main')).not.toHaveAttribute('inert');
		await page.setViewportSize({ width: 390, height: 844 });
		await expect(trigger).toHaveAttribute('aria-expanded', 'false');
	}
	await page.getByRole('button', { name: 'Remove Search: Harbour', exact: true }).click();
	await expect(page.locator('.result-count')).toBeFocused();
});

test('view and record selection expose state and work from the keyboard', async ({ page }) => {
	await page.goto(dashboard);
	// Retry focus movement until hydration attaches the radio keyboard handler.
	await expect(async () => {
		await page.getByRole('radio', { name: 'Grouped', exact: true }).focus();
		await page.keyboard.press('ArrowRight');
		await expect(page.getByRole('radio', { name: 'Table', exact: true })).toBeFocused();
	}).toPass();
	await page.keyboard.press('Space');
	await expect(page.getByRole('radio', { name: 'Table', exact: true })).toHaveAttribute(
		'aria-checked',
		'true'
	);
	await page.goto(detail);
	if (page.viewportSize()!.width <= 700) {
		const picker = page.getByRole('combobox', { name: 'Project record', exact: true });
		await picker.focus();
		await picker.press('Enter');
		const list = page.getByRole('listbox', { name: 'Project record', exact: true });
		await expect(list).toBeVisible();
		await expect(picker).toHaveAttribute('aria-expanded', 'true');
		await expect(picker).toHaveAttribute('aria-controls', (await list.getAttribute('id'))!);
		await expect(page.getByRole('main').getByRole('listbox')).toBeVisible();
		await expect(picker).toBeFocused();
		await expect(page.getByRole('option', { selected: true })).toHaveCount(1);
		await expect(list.locator('[data-highlighted]')).toHaveAttribute(
			'id',
			(await picker.getAttribute('aria-activedescendant'))!
		);
		await accessibilityScan(page);
		await picker.press('Escape');
		await expect(picker).toBeFocused();
		await expect(picker).toHaveAttribute('aria-expanded', 'false');
		await expect(picker).not.toHaveAttribute('aria-controls');
		await expect(list).toBeHidden();
		await picker.press('Space');
		await expect(list).toBeVisible();
		await page.keyboard.press('ArrowDown');
		await page.keyboard.press('Enter');
	} else {
		const nav = page.getByRole('navigation', { name: 'Project workflow records' });
		await expect(nav.locator('[aria-current=page]')).toHaveCount(1);
		await nav.getByRole('link').nth(1).focus();
		await page.keyboard.press('Enter');
	}
	await expect(page).toHaveURL(/record=.*(?:notes|decisions)/);
	await page.reload();
	await accessibilityScan(page);
	const documents = page.getByRole('navigation', { name: 'Markdown documents' });
	await expect(documents.locator('[aria-current=page]')).toHaveCount(1);
});
