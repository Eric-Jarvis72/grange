import { expect, test } from "@playwright/test";
import { register, resetServer, uniqueName, waitForTrainStop, waitForWorld, walkUntilPrompt } from "./helpers";

test("enter the livestock market and buy a pig from its pen", async ({ page }) => {
	await resetServer();
	await register(page, uniqueName("Rancher"));
	const canvas = page.locator("canvas.farm-map-canvas");
	const prompt = page.getByTestId("travel-prompt");

	await page.keyboard.down("d");
	await page.waitForTimeout(1_000);
	await page.keyboard.up("d");
	await expect(prompt).toContainText("travel to the marketplace");
	await page.keyboard.press("e");
	await expect(canvas).toHaveAttribute("aria-label", /^Marketplace map/);
	await waitForTrainStop(page);

	await walkUntilPrompt(page, ["a"], "enter the livestock market");
	await page.keyboard.press("e");
	await expect(canvas).toHaveAttribute("aria-label", /^Livestock Market map/);
	await page.keyboard.down("w");
	await page.waitForTimeout(750);
	await page.keyboard.up("w");
	await walkUntilPrompt(page, ["d"], "buy a pig");
	await page.keyboard.press("e");

	const purchase = page.getByTestId("livestock-purchase");
	await expect(purchase).toBeVisible();
	await expect(purchase).toContainText("$55");
	await page.getByTestId("livestock-buy").click();
	await expect(purchase).toContainText("Pig purchased!");
	await expect(page.getByTestId("farm-balance")).toContainText("45");
	await expect(page.getByTestId("livestock-owned")).toHaveText("1");

	await page.reload();
	await waitForWorld(page);
	await expect(page.getByTestId("farm-balance")).toContainText("45");
	await page.getByTestId("open-inventory").click();
	await expect(page.getByTestId("inventory-panel").locator('[data-item="pig"]')).toHaveCount(1);
});
