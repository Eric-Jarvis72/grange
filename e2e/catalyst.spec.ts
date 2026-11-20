import { expect, test } from "@playwright/test";
import { TILE_SIZE } from "../src/world/mapData";
import {
	BASE,
	clickFarmTile,
	clickWorld,
	registerFast,
	uniqueName,
	waitForWorld,
} from "./helpers";

test("admins can spawn catalysts from the inventory", async ({ page }) => {
	await registerFast(page, uniqueName("SpawnerAdmin"));
	const promoted = await page.request.post(`${BASE}/api/dev/admin`);
	expect(promoted.ok()).toBeTruthy();

	await page.reload();
	await waitForWorld(page);
	await page.keyboard.press("i");

	const spawner = page.getByTestId("admin-spawner");
	await expect(spawner).toBeVisible();
	await page.getByTestId("admin-spawn-select").selectOption("sun-shard");
	await page.getByTestId("admin-spawn-count").fill("2");
	await page.getByTestId("admin-spawn-button").click();

	await expect(page.getByTestId("admin-spawn-notice")).toContainText(
		"Spawned 2 Sun Shard",
	);
});

test("right-clicking a catalyst stack uses it", async ({ page }) => {
	test.setTimeout(120_000);
	await registerFast(page, uniqueName("Shard"));

	// A planted (not necessarily grown) tomato is enough to queue a transform.
	await clickFarmTile(page, 9, 7);
	await page.keyboard.press("2");
	await clickWorld(page, 9.5 * TILE_SIZE, 7.5 * TILE_SIZE);
	await expect(page.getByTestId("farm-tile")).toContainText("(9, 7): planted");

	const granted = await page.request.post(`${BASE}/api/dev/item`, {
		data: { item: "sun-shard", count: 1 },
	});
	expect(granted.ok()).toBeTruthy();

	await page.reload();
	await waitForWorld(page);
	await page.keyboard.press("i");
	const panel = page.getByTestId("inventory-panel");
	await expect(panel).toBeVisible();

	const shard = panel.locator('[data-item="sun-shard"]');
	await expect(shard).toHaveCount(1);
	await shard.click({ button: "right" });

	await expect(page.getByTestId("notification-feed")).toContainText(
		"will transform your Tomato at dawn",
	);
	await expect(shard).toHaveCount(0);
});

test("a catalyst transforms matching crops at dawn", async ({ page }) => {
	test.setTimeout(150_000);
	await registerFast(page, uniqueName("Catalyst"));

	// Grow one tomato on the starting plot.
	await clickFarmTile(page, 9, 7);
	await expect(page.getByTestId("farm-tile")).toContainText("(9, 7): tilled");
	const workTile = () => clickWorld(page, 9.5 * TILE_SIZE, 7.5 * TILE_SIZE);

	await page.keyboard.press("2");
	await workTile();
	await expect(page.getByTestId("farm-tile")).toContainText("(9, 7): planted");

	await page.keyboard.press("3");
	await workTile();
	await expect(page.getByTestId("farm-tile")).toContainText(
		/\(9, 7\): (?:watered|ready)/,
	);
	await expect(page.getByTestId("farm-tile")).toContainText("(9, 7): ready", {
		timeout: 20_000,
	});

	// Dev hook: grant a Sun Shard, then reload so the lobby item hydration adds it.
	const granted = await page.request.post(`${BASE}/api/dev/item`, {
		data: { item: "sun-shard", count: 1 },
	});
	expect(granted.ok()).toBeTruthy();

	await page.reload();
	await waitForWorld(page);
	await page.keyboard.press("9");
	const shard = page.locator('[data-item="sun-shard"]');
	await expect(shard).toHaveCount(1);

	// Selecting the catalyst and clicking the world uses it.
	await page.mouse.click(500, 400);
	await expect(page.getByTestId("notification-feed")).toContainText(
		"will transform your Tomato at dawn",
	);
	await expect(shard).toHaveCount(0);

	// Force the next dawn, then harvest the rare produce.
	const dawn = await page.request.post(`${BASE}/api/dev/dawn`);
	expect(dawn.ok()).toBeTruthy();
	await expect(page.getByTestId("notification-feed")).toContainText(
		"transformed 1 crop into Sun-Burst Tomato",
	);

	await page.keyboard.press("4");
	await clickFarmTile(page, 9, 7);
	await expect(page.locator('[data-item="sunburst_tomato"]')).toHaveAttribute(
		"data-count",
		"1",
	);
});
