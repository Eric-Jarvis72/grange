import { expect, test, type Page } from "@playwright/test";
import {
	clickFarmTile,
	farmTilePixel,
	farmTilePosition,
	hoverFarmTile,
	registerFast,
	uniqueName,
	walkUntilPrompt,
} from "./helpers";

async function worldPoint(page: Page, worldX: number, worldY: number) {
	const box = await page.locator(".farm-map-canvas").boundingBox();
	expect(box).not.toBeNull();
	return { x: box!.x + worldX / 1152 * box!.width,
		y: box!.y + worldY / 768 * box!.height };
}

async function clickWorld(page: Page, worldX: number, worldY: number) {
	const point = await worldPoint(page, worldX, worldY);
	await page.mouse.click(point.x, point.y);
}

test("farming loop: hoe, seed, bucket, grow, scythe", async ({ page }) => {
	await registerFast(page, uniqueName("Sprout"));
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
	// The harvested tomato lands in the first free inventory slot after the tools.
	await expect(page.locator('[data-item="tomato"]')).toHaveAttribute(
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
	await registerFast(page, uniqueName("Hoer"));
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
	await registerFast(page, uniqueName("Sprout"));
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

test("a gate places, opens with E, and returns to inventory when shoveled", async ({ page }) => {
	await registerFast(page, uniqueName("Gater"));
	await expect(page).toHaveURL(/\/world$/);
	await expect(page.getByTestId("notification-feed")).toBeVisible();

	await page.keyboard.press("5");
	await clickFarmTile(page, 8, 8);
	await expect(page.getByTestId("slot-hotbar-4")).toHaveAttribute("data-count", "1");

	// The player spawns within reach of this gate, so its prompt appears at once.
	await expect(page.getByTestId("travel-prompt")).toContainText("open gate");
	await page.keyboard.press("e");
	await expect(page.getByTestId("travel-prompt")).toContainText("close gate");

	await page.keyboard.press("7");
	await clickFarmTile(page, 8, 8);
	await expect(page.getByTestId("slot-hotbar-4")).toHaveAttribute("data-count", "2");
});

test("fence placement previews on hold and commits only on a valid release", async ({ page }) => {
	await registerFast(page, uniqueName("FencePreview"));
	await page.keyboard.press("6");
	const slot = page.getByTestId("slot-hotbar-5");
	const point = await farmTilePosition(page, 7, 5);
	await page.mouse.move(point.x, point.y);
	await page.mouse.down();
	await expect(slot).toHaveAttribute("data-count", "20");
	await page.mouse.up();
	await expect(slot).toHaveAttribute("data-count", "19");
	await page.mouse.down();
	await page.mouse.up();
	await expect(slot).toHaveAttribute("data-count", "19");
});

test("the shovel moves a well and sign through inventory", async ({ page }) => {
	await registerFast(page, uniqueName("Mover"));
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

test("a carried house previews during drag and can return to its original spot", async ({ page }) => {
	await registerFast(page, uniqueName("Builder"));
	await page.keyboard.press("7");
	await clickWorld(page, 210, 200);
	const houseSlot = page.locator('[data-item="farmhouse"]');
	await expect(houseSlot).toHaveCount(1);
	await houseSlot.click();

	const canvas = page.locator(".farm-map-canvas");
	const before = await canvas.screenshot();
	const blocked = await worldPoint(page, 200, 400);
	await page.mouse.move(blocked.x, blocked.y);
	await page.mouse.down();
	await expect(houseSlot).toHaveCount(1);
	const preview = await canvas.screenshot();
	expect(preview.equals(before)).toBe(false);
	await page.mouse.up();
	await expect(houseSlot).toHaveCount(1);

	const original = await worldPoint(page, 210, 260);
	await page.mouse.move(original.x, original.y);
	await page.mouse.down();
	await expect(houseSlot).toHaveCount(1);
	await page.mouse.up();
	await expect(houseSlot).toHaveCount(0);
});

test("a carried sign can be dropped directly on the road path", async ({ page }) => {
	await registerFast(page, uniqueName("Roadsign"));
	await page.keyboard.press("7");
	await clickWorld(page, 395, 360);
	const signSlot = page.locator('[data-item="sign"]');
	await expect(signSlot).toHaveCount(1);
	await signSlot.click();
	const road = await worldPoint(page, 600, 288);
	await page.mouse.move(road.x, road.y);
	await page.mouse.down();
	await expect(signSlot).toHaveCount(1);
	await page.mouse.up();
	await expect(signSlot).toHaveCount(0);
});

test("the hoe refuses tiles behind buildings", async ({ page }) => {
	await registerFast(page, uniqueName("Sprout"));
	await expect(page).toHaveURL(/\/world$/);

	await clickFarmTile(page, 3, 2);
	await expect(page.getByTestId("notification-feed")).toContainText(
		"Something is in the way.",
	);
	await expect(page.getByTestId("farm-tile")).toContainText("(3, 2): grass");
});

test("flowers can be shoveled before tilling their tile", async ({ page }) => {
	await registerFast(page, uniqueName("Sprout"));
	await expect(page).toHaveURL(/\/world$/);

	await page.keyboard.press("7");
	await clickFarmTile(page, 11, 3);
	await expect(page.getByTestId("notification-feed")).toContainText("inventory");
	await page.keyboard.press("1");
	await clickFarmTile(page, 11, 3);
	await expect(page.getByTestId("farm-tile")).toContainText("(11, 3): tilled");
});

test("a visitor sees another farm read-only but can toggle its gates", async ({ page }) => {
	const owner = uniqueName("Owner");
	await registerFast(page, owner);
	await page.keyboard.press("5");
	await clickFarmTile(page, 8, 8);
	await expect(page.getByTestId("slot-hotbar-4")).toHaveAttribute("data-count", "1");

	// Farms start private, so open this one before signing out.
	await walkUntilPrompt(page, ["a", "w"], "enter the farmhouse", 20_000);
	await page.keyboard.press("e");
	await page.getByTestId("house-visibility-toggle").click();
	await expect(page.getByTestId("house-visibility-toggle")).toContainText("Public");
	await page.getByTestId("house-close").click();

	await page.keyboard.press("Escape");
	await page.getByTestId("logout").click();
	await page.waitForURL("**/");

	await registerFast(page, uniqueName("Visitor"));
	await page.goto(`/farms/${encodeURIComponent(owner)}`);

	await expect(page.locator("canvas[aria-label^='Farm map']")).toBeVisible();
	await expect(page.getByTestId("notification-feed")).toContainText("Visiting");
	await expect(page.getByTestId("travel-prompt")).toContainText("open gate");
	await page.keyboard.press("e");
	await expect(page.getByTestId("travel-prompt")).toContainText("close gate");

	// Placement is still owner-only.
	await page.keyboard.press("6");
	await clickFarmTile(page, 7, 8);
	await expect(page.getByTestId("notification-feed")).toContainText(
		"visitor editing off",
	);
});

test("tilled soil renders as brown dirt, not grass", async ({ page }) => {
	await registerFast(page, uniqueName("Soil"));

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
