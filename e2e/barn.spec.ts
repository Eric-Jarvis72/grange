import { expect, test, type Page } from "@playwright/test";
import { clickWorld, registerFast, uniqueName, waitForWorld } from "./helpers";

/** Where the barn's sprite sits on the farm map (bottom-anchored). */
const BARN = { x: 935, y: 200 };

/** Clicks the barn on the map and waits for the storage window. */
async function openBarn(page: Page) {
	await clickWorld(page, BARN.x, BARN.y);
	await expect(page.getByTestId("barn-window")).toBeVisible();
}

/**
 * Walks from the farm spawn to the barn's front. A short north leg clears the
 * barrels beside the barn, then the up-right diagonal reaches its base.
 */
async function walkToBarn(page: Page) {
	const prompt = page.getByTestId("travel-prompt");
	await page.keyboard.down("w");
	await page.waitForTimeout(700);
	await page.keyboard.down("d");
	try {
		await expect(prompt).toContainText("open the barn", { timeout: 15_000 });
	} finally {
		await page.keyboard.up("w");
		await page.keyboard.up("d");
	}
}

test("the barn stores a stack and returns it to the inventory", async ({
	page,
}) => {
	await registerFast(page, uniqueName("Storer"));

	// Select the seed-bag stack (hotbar slot 2) before opening the barn.
	await page.keyboard.press("2");
	await openBarn(page);
	// Shift+E quick-moves the selected hotbar stack into storage.
	await page.keyboard.press("Shift+E");
	await expect(page.getByTestId("barn-slot-0")).toHaveAttribute(
		"data-item",
		"seed-bag",
	);
	await expect(page.getByTestId("barn-slot-0")).toHaveAttribute(
		"data-count",
		"10",
	);
	await expect(page.getByTestId("barn-message")).toContainText("Stored 10");
	// The stored stack left the player's hotbar slot.
	const barnHotbar = page.getByTestId("barn-player-hotbar");
	await expect(barnHotbar.getByTestId("slot-hotbar-1")).toHaveAttribute(
		"data-item",
		"",
	);

	// Clicking a storage slot takes the stack back into the inventory.
	await page.getByTestId("barn-slot-0").click();
	await expect(page.getByTestId("barn-slot-0")).toHaveAttribute("data-item", "");
	await expect(page.getByTestId("barn-message")).toContainText("Took 10");
	await expect(barnHotbar.getByTestId("slot-hotbar-1")).toHaveAttribute(
		"data-item",
		"seed-bag",
	);

	// Escape closes the window.
	await page.keyboard.press("Escape");
	await expect(page.getByTestId("barn-window")).toHaveCount(0);
});

test("standing at the barn and pressing E opens storage", async ({ page }) => {
	await registerFast(page, uniqueName("Walker"));

	await walkToBarn(page);
	await page.keyboard.press("e");
	await expect(page.getByTestId("barn-window")).toBeVisible();

	// Escape closes it, and the prompt remains while still at the barn.
	await page.keyboard.press("Escape");
	await expect(page.getByTestId("barn-window")).toHaveCount(0);
	await expect(page.getByTestId("travel-prompt")).toContainText("open the barn");
});

test("barn storage survives a reload", async ({ page }) => {
	await registerFast(page, uniqueName("Keeper"));

	await page.keyboard.press("2");
	await openBarn(page);
	await page.keyboard.press("Shift+E");
	await expect(page.getByTestId("barn-slot-0")).toHaveAttribute(
		"data-item",
		"seed-bag",
	);

	// A fresh client still shows the server-held storage.
	await page.reload();
	await waitForWorld(page);
	await openBarn(page);
	await expect(page.getByTestId("barn-slot-0")).toHaveAttribute(
		"data-item",
		"seed-bag",
	);
});
