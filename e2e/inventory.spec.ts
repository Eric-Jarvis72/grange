import { expect, test } from "@playwright/test";
import {
	enterFarm,
	register,
	registerAccount,
	resetServer,
	uniqueName,
} from "./helpers";

test("HUD shows hotbar and prompts with a clear top screen", async ({
	page,
}) => {
	await resetServer();
	await register(page, uniqueName("Sprout"));

	await expect(page.getByTestId("hotbar")).toBeVisible();
	await expect(page.getByTestId("slot-hotbar-0")).toBeVisible();
	await expect(page.getByTestId("slot-hotbar-9")).toBeVisible();
	await expect(page.getByTestId("open-inventory")).toContainText("Inventory");
	await expect(page.getByTestId("open-pause")).toContainText("Pause");
	await expect(page.getByTestId("notification-feed")).toBeVisible();

	// Top screen stays clear: no HUD element may sit in the top 15%.
	const topIntruders = await page.evaluate(() => {
		const limit = window.innerHeight * 0.15;
		const hits: string[] = [];
		for (const el of document.querySelectorAll(
			"[data-testid='hotbar'], [data-testid='open-inventory'], [data-testid='open-pause'], [data-testid='farm-balance'], [data-testid='notification-feed']",
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
	await expect(page.getByTestId("player-model")).toBeVisible();
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

test("Grangecoin is a wallet counter, not an inventory item", async ({
	page,
}) => {
	await resetServer();
	await register(page, uniqueName("Sprout"));

	// No Grangecoin occupies inventory slots.
	await expect(page.getByTestId("hotbar")).toBeVisible();
	await page.keyboard.press("i");
	await expect(page.getByTestId("inventory-panel")).toBeVisible();

	const coinSlots = page.locator("[data-testid^='slot-'][data-item='grangecoin']");
	await expect(coinSlots).toHaveCount(0);

	// The wallet counter is shown instead.
	await expect(page.getByTestId("farm-balance")).toContainText("100");
	await expect(page.getByTestId("preview-coins")).toContainText("100");
});

test("Escape opens the pause menu and Resume closes it", async ({ page }) => {
	await resetServer();
	await register(page, uniqueName("Sprout"));

	await expect(page.getByTestId("pause-menu")).toHaveCount(0);
	await page.keyboard.press("Escape");
	const pause = page.getByTestId("pause-menu");
	await expect(pause).toBeVisible();
	await expect(pause).toContainText("Paused");

	await page.getByTestId("pause-resume").click();
	await expect(page.getByTestId("pause-menu")).toHaveCount(0);
});

test("Quit to Main Menu keeps the session and returns to the menu", async ({
	page,
}) => {
	await resetServer();
	const name = uniqueName("Sprout");
	await registerAccount(page, name);
	await enterFarm(page);

	await page.keyboard.press("Escape");
	await page.getByTestId("pause-quit-menu").click();

	await expect(page).toHaveURL("/");
	await expect(page.getByTestId("menu-user")).toContainText(name);

	// The session is intact, so Continue re-enters the farm.
	await enterFarm(page);
	await expect(page).toHaveURL(/\/world$/);
});

