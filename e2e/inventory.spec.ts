import { expect, test } from "@playwright/test";
import { register, resetServer, uniqueName } from "./helpers";

test("HUD shows hotbar and prompts with a clear top screen", async ({
	page,
}) => {
	await resetServer();
	await register(page, uniqueName("Sprout"));

	await expect(page.getByTestId("hotbar")).toBeVisible();
	await expect(page.getByTestId("slot-hotbar-0")).toBeVisible();
	await expect(page.getByTestId("slot-hotbar-9")).toBeVisible();
	await expect(page.getByTestId("open-inventory")).toContainText("Inventory");

	// Top screen stays clear: no HUD element may sit in the top 15%.
	const topIntruders = await page.evaluate(() => {
		const limit = window.innerHeight * 0.15;
		const hits: string[] = [];
		for (const el of document.querySelectorAll(
			"[data-testid='hotbar'], [data-testid='open-inventory'], [data-testid='logout']",
		)) {
			const rect = (el as HTMLElement).getBoundingClientRect();
			if (rect.bottom <= limit) hits.push((el as HTMLElement).dataset.testid ?? "?");
		}
		return hits;
	});
	expect(topIntruders).toEqual([]);
});

test("number keys select hotbar slots and I toggles inventory", async ({
	page,
}) => {
	await resetServer();
	await register(page, uniqueName("Sprout"));

	const hotbar = page.getByTestId("hotbar");
	await expect(hotbar).toBeVisible();

	await page.keyboard.press("3");
	await expect(page.getByTestId("preview-equipped")).toHaveCount(0);

	await page.keyboard.press("i");
	const panel = page.getByTestId("inventory-panel");
	await expect(panel).toBeVisible();
	await expect(page.getByTestId("inventory-grid")).toBeVisible();
	await expect(page.getByTestId("preview-equipped")).toContainText(
		"Watering Can",
	);

	await page.keyboard.press("1");
	await expect(page.getByTestId("preview-equipped")).toContainText("Hoe");

	await page.keyboard.press("Escape");
	await expect(panel).toHaveCount(0);

	await page.getByTestId("open-inventory").click();
	await expect(page.getByTestId("inventory-panel")).toBeVisible();
	await page.getByTestId("inventory-close").click();
	await expect(page.getByTestId("inventory-panel")).toHaveCount(0);
});

test("Grangecoin lives in slots with no wallet counter", async ({ page }) => {
	await resetServer();
	await register(page, uniqueName("Sprout"));

	await expect(page.getByTestId("hotbar")).toBeVisible();
	await page.keyboard.press("i");
	await expect(page.getByTestId("inventory-panel")).toBeVisible();

	const coinSlots = page.locator("[data-testid^='slot-'][data-item='grangecoin']");
	await expect(coinSlots.first()).toBeVisible();
	expect(await coinSlots.count()).toBeGreaterThanOrEqual(2);

	// No persistent coin counter outside slots.
	await expect(page.getByTestId("grangecoin-counter")).toHaveCount(0);
});
