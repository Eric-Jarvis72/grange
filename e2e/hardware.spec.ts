import { expect, test } from "@playwright/test";
import { MAP_COLUMNS, MAP_ROWS } from "../src/world/mapData";
import {
	BASE,
	hoverFarmTile,
	registerFast,
	uniqueName,
	useDoor,
	waitForWorld,
	walkToHardwareStore,
} from "./helpers";

test("the hardware stall opens a market window and sells sprinklers", async ({
	page,
}) => {
	await registerFast(page, uniqueName("Builder"), { area: "marketplace" });

	await walkToHardwareStore(page);
	await useDoor(page);

	const store = page.getByTestId("market-window");
	await expect(store).toBeVisible();
	await expect(page.getByTestId("market-title")).toHaveText("Hardware Store");
	await expect(page.getByTestId("farm-balance")).toContainText("100");

	// Tools tab: you already own the starter tools, so they read as owned.
	await expect(page.getByTestId("market-subtab-equipment")).toBeVisible();
	await expect(page.getByTestId("market-owned-hoe")).toContainText("1");
	await expect(page.getByTestId("market-action-hoe")).toBeDisabled();

	// Building tab: fences and gates restock the farm supply.
	await page.getByTestId("market-subtab-build").click();
	await expect(
		page.getByTestId("market-item-fence").locator("img"),
	).toHaveCount(1);
	await expect(page.getByTestId("market-owned-fence")).toContainText("20");
	await page.getByTestId("market-action-fence").click();
	await expect(page.getByTestId("market-owned-fence")).toContainText("21");
	await expect(page.getByTestId("farm-balance")).toContainText("95");

	// Automation tab sells sprinklers.
	await page.getByTestId("market-subtab-supplies").click();
	await expect(page.getByTestId("market-item-sprinkler")).toContainText(
		"Sprinkler",
	);
	await expect(page.getByTestId("market-owned-sprinkler")).toContainText("0");
	await page.getByTestId("market-action-sprinkler").click();
	await expect(page.getByTestId("market-owned-sprinkler")).toContainText("1");
	await expect(page.getByTestId("farm-balance")).toContainText("20");
	await expect(page.getByTestId("market-message")).toContainText(
		"Bought 1 Sprinkler",
	);

	await page.getByTestId("market-close").click();
	await expect(store).toHaveCount(0);
});

test("a sprinkler placed on tilled soil waters its 2x2", async ({ page }) => {
	await registerFast(page, uniqueName("Waterer"));

	// Till the spawn tile of the field first: the sprinkler must be allowed on
	// worked soil without getting in the way of planting.
	await page.keyboard.press("1");
	await page.keyboard.press("Space");
	await hoverFarmTile(page, 9, 9);
	await expect(page.getByTestId("farm-tile")).toContainText("(9, 9): tilled");

	// Buy through the server, then reload so the hotbar mirrors the supply.
	const bought = await page.request.post(`${BASE}/api/hardware/buy`, {
		data: { item: "sprinkler", quantity: 1 },
	});
	expect(bought.ok()).toBeTruthy();
	await page.reload();
	await waitForWorld(page);

	const sprinklerSlot = page.locator('[data-item="sprinkler"]');
	await expect(sprinklerSlot).toHaveAttribute("data-count", "1");

	// Select the sprinkler and drop it on the corner that covers the tilled tile.
	await page.keyboard.press("9");
	const box = await page.locator("canvas.farm-map-canvas").boundingBox();
	if (!box) throw new Error("the world canvas is not laid out");
	await page.mouse.move(
		box.x + (9 / MAP_COLUMNS) * box.width,
		box.y + (9 / MAP_ROWS) * box.height,
	);
	await page.mouse.down();
	await page.mouse.up();
	await expect(page.locator(".farm-map-page")).toHaveAttribute(
		"data-sprinklers",
		"8,8",
	);

	// Planting over the sprinkled tile still works, and the sprinkler waters it
	// on its own tick with no watering action. The e2e clock ripens a watered
	// crop almost immediately, so accept either state: reaching `ready` at all
	// proves the sprinkler watered it (an unwatered planted tile never grows).
	await page.keyboard.press("2");
	await page.keyboard.press("Space");
	await hoverFarmTile(page, 9, 9);
	await expect(page.getByTestId("farm-tile")).toContainText(
		/\(9, 9\): (?:watered|ready)/,
		{ timeout: 10_000 },
	);
});
