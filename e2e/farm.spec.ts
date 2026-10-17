import { expect, test, type Page } from "@playwright/test";
import {
	clickFarmTile,
	farmTilePixel,
	farmTilePosition,
	hoverFarmTile,
	register,
	resetServer,
	uniqueName,
} from "./helpers";

async function clickWorld(page: Page, worldX: number, worldY: number) {
	const box = await page.locator(".farm-map-canvas").boundingBox();
	expect(box).not.toBeNull();
	await page.mouse.click(box!.x + worldX / 1152 * box!.width,
		box!.y + worldY / 768 * box!.height);
}

test("farming loop: hoe, seed, bucket, grow, scythe", async ({ page }) => {
	await resetServer();
	await register(page, uniqueName("Sprout"));
	await expect(page).toHaveURL(/\/world$/);
	await expect(page.getByTestId("farm-tile")).toBeVisible();
	// The hotbar starts on the hoe.
	await expect(page.getByTestId("slot-hotbar-0")).toHaveClass(/inv-slot-selected/);

	// Hoe tile (9, 7)
	await clickFarmTile(page, 9, 7);
	await expect(page.getByTestId("farm-tile")).toContainText("(9, 7): tilled");

	// Seeds (hotbar slot 2 maps to key "2")
	await page.keyboard.press("2");
	await expect(page.getByTestId("slot-hotbar-1")).toHaveClass(/inv-slot-selected/);
	await clickFarmTile(page, 9, 7);
	await expect(page.getByTestId("farm-tile")).toContainText("(9, 7): planted");
	// Planting spends one tomato seed from the pouch (10 -> 9).
	await expect(page.getByTestId("slot-hotbar-1")).toHaveAttribute(
		"data-count",
		"9",
	);

	// Bucket
	await page.keyboard.press("3");
	await clickFarmTile(page, 9, 7);
	await expect(page.getByTestId("farm-tile")).toContainText("(9, 7): watered");

	// Wait for 10s growth, then harvest
	await expect(page.getByTestId("farm-tile")).toContainText("(9, 7): ready", {
		timeout: 20_000,
	});
	await page.keyboard.press("4");
	await clickFarmTile(page, 9, 7);
	// The harvested tomato lands in the first free inventory slot (hotbar 5).
	await expect(page.getByTestId("slot-hotbar-4")).toHaveAttribute(
		"data-count",
		"1",
	);
	// Tomatoes regrow, so the tile resumes growing instead of clearing.
	await expect(page.getByTestId("farm-tile")).toContainText("(9, 7): watered");

	// Drag-paint tills two tiles at once
	await page.keyboard.press("1");
	const from = await farmTilePosition(page, 7, 6);
	const to = await farmTilePosition(page, 8, 6);
	await page.mouse.move(from.x, from.y);
	await page.mouse.down();
	await page.mouse.move(to.x, to.y, { steps: 5 });
	await page.mouse.up();
	await expect(page.getByTestId("farm-tile")).toContainText("(8, 6): tilled");
});

// Focused regression guard for the core farming verb: select the hoe, click an
// open square, and require the server to flip it to tilled. Kept small and
// fast so a broken click->till path fails here loudly instead of inside the
// long, growth-timed farming-loop test above.
test("hoe click tills an open grass square", async ({ page }) => {
	await resetServer();
	await register(page, uniqueName("Hoer"));
	await expect(page).toHaveURL(/\/world$/);

	// The hotbar starts on the hoe.
	await expect(page.getByTestId("slot-hotbar-0")).toHaveClass(
		/inv-slot-selected/,
	);
	const tiles = page.getByTestId("farm-map-tiles");
	await expect(tiles).toHaveText("0 tiles");

	// Plain open grass square. Hover first and require the readout to name the
	// tile we mean to click, so a drifted canvas layout fails here rather than
	// silently hoeing a different square.
	const grass = { column: 9, row: 7 };
	await hoverFarmTile(page, grass.column, grass.row);
	await expect(page.getByTestId("farm-tile")).toContainText(
		`(${grass.column}, ${grass.row}):`,
	);
	await clickFarmTile(page, grass.column, grass.row);
	await expect(page.getByTestId("farm-tile")).toContainText(
		`(${grass.column}, ${grass.row}): tilled`,
	);
	await expect(tiles).toHaveText("1 tiles");
});

test("a fence places, blocks hoeing, and returns to inventory when shoveled", async ({ page }) => {
	await resetServer();
	await register(page, uniqueName("Sprout"));
	await expect(page).toHaveURL(/\/world$/);
	await expect(page.getByTestId("notification-feed")).toBeVisible();

	await page.keyboard.press("6");
	await clickFarmTile(page, 7, 5);
	await expect(page.getByTestId("slot-hotbar-5")).toHaveAttribute("data-count", "19");
	await page.keyboard.press("1");
	await clickFarmTile(page, 7, 5);
	await expect(page.getByTestId("notification-feed")).toContainText(
		"Something is in the way.",
	);
	await expect(page.getByTestId("farm-tile")).toContainText("(7, 5): grass");
	await page.keyboard.press("7");
	await clickFarmTile(page, 7, 5);
	await expect(page.getByTestId("slot-hotbar-5")).toHaveAttribute("data-count", "20");
	await page.keyboard.press("1");
	await clickFarmTile(page, 7, 5);
	await expect(page.getByTestId("farm-tile")).toContainText("(7, 5): tilled");
});

test("the shovel moves a well and sign through inventory", async ({ page }) => {
	await resetServer();
	await register(page, uniqueName("Mover"));
	await page.keyboard.press("7");
	await clickWorld(page, 200, 350);
	const wellSlot = page.locator('[data-item="well"]');
	await expect(wellSlot).toHaveCount(1);
	await wellSlot.click();
	await clickFarmTile(page, 8, 7);
	await expect(wellSlot).toHaveCount(0);

	await page.keyboard.press("7");
	await clickWorld(page, 395, 360);
	const signSlot = page.locator('[data-item="sign"]');
	await expect(signSlot).toHaveCount(1);
	await signSlot.click();
	await clickFarmTile(page, 6, 7);
	await expect(signSlot).toHaveCount(0);
});

test("the hoe refuses tiles behind buildings", async ({ page }) => {
	await resetServer();
	await register(page, uniqueName("Sprout"));
	await expect(page).toHaveURL(/\/world$/);

	await clickFarmTile(page, 3, 2);
	await expect(page.getByTestId("notification-feed")).toContainText(
		"Something is in the way.",
	);
	await expect(page.getByTestId("farm-tile")).toContainText("(3, 2): grass");
});

test("flowers can be shoveled before tilling their tile", async ({ page }) => {
	await resetServer();
	await register(page, uniqueName("Sprout"));
	await expect(page).toHaveURL(/\/world$/);

	await page.keyboard.press("7");
	await clickFarmTile(page, 11, 3);
	await expect(page.getByTestId("notification-feed")).toContainText("inventory");
	await page.keyboard.press("1");
	await clickFarmTile(page, 11, 3);
	await expect(page.getByTestId("farm-tile")).toContainText("(11, 3): tilled");
});

test("hoeing and planting a tile round-trips through the server", async ({
	page,
}) => {
	await resetServer();
	await register(page, uniqueName("Farmer"));

	const canvas = page.locator("canvas[aria-label^='Farm map']");
	await expect(canvas).toBeVisible();

	const tiles = page.getByTestId("farm-map-tiles");
	await expect(tiles).toHaveText("0 tiles");

	// The player spawns on a farmable tile, so the selected tool acts immediately.
	await page.getByTestId("slot-hotbar-0").click();
	await page.keyboard.press("Space");
	await expect(tiles).toHaveText("1 tiles");

	await page.getByTestId("slot-hotbar-1").click();
	await page.keyboard.press("Space");
	await expect(tiles).toHaveText("1 tiles");
});

test("selecting a hotbar slot highlights it", async ({ page }) => {
	await resetServer();
	await register(page, uniqueName("Farmer"));

	await page.getByTestId("slot-hotbar-2").click();
	await expect(page.getByTestId("slot-hotbar-2")).toHaveClass(/inv-slot-selected/);
	await expect(page.getByTestId("slot-hotbar-0")).not.toHaveClass(
		/inv-slot-selected/,
	);
});

test("a visitor sees another farm read-only", async ({ page }) => {
	await resetServer();
	const owner = uniqueName("Owner");
	await register(page, owner);
	await page.keyboard.press("Escape");
	await page.getByTestId("logout").click();
	await page.waitForURL("**/");

	await register(page, uniqueName("Visitor"));
	await page.goto(`/farms/${encodeURIComponent(owner)}`);

	await expect(page.locator("canvas[aria-label^='Farm map']")).toBeVisible();
	await expect(page.getByTestId("notification-feed")).toContainText("Visiting");
});

test("tilled soil renders as brown dirt, not grass", async ({ page }) => {
	await resetServer();
	await register(page, uniqueName("Soil"));

	const grass = await farmTilePixel(page, 9, 7);
	// Grass is green-dominant.
	expect(grass.g).toBeGreaterThan(grass.r);

	await clickFarmTile(page, 9, 7);
	await expect(page.getByTestId("farm-tile")).toContainText("(9, 7): tilled");

	// Tilled-dry soil is brown: red dominant over green and blue.
	const soil = await farmTilePixel(page, 9, 7);
	expect(soil.r).toBeGreaterThan(soil.g + 20);
	expect(soil.r).toBeGreaterThan(soil.b + 20);
});
