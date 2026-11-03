import { expect, test } from "@playwright/test";
import {
	holdKeys,
	registerFast,
	rideTrain,
	TRAVEL_TIMEOUT,
	uniqueName,
	waitForTrainStop,
	waitForWorld,
	walkUntilPrompt,
} from "./helpers";

test("enter the livestock market and buy a pig from its pen", async ({
	page,
}) => {
	await registerFast(page, uniqueName("Rancher"));
	const canvas = page.locator("canvas.farm-map-canvas");

	await walkUntilPrompt(page, ["d"], "board the train");
	await rideTrain(page, "marketplace");
	await expect(canvas).toHaveAttribute("aria-label", /^Marketplace map/, {
		timeout: TRAVEL_TIMEOUT,
	});
	await waitForTrainStop(page);

	await walkUntilPrompt(page, ["a"], "enter the livestock market");
	await page.keyboard.press("e");
	await expect(canvas).toHaveAttribute("aria-label", /^Livestock Market map/);

	// Step into the aisle, then walk east until a pen is in reach.
	await holdKeys(page, ["w"], 750);
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
	await expect(
		page.getByTestId("inventory-panel").locator('[data-item="pig"]'),
	).toHaveCount(1);
});
