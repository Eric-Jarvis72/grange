import { expect, test } from "@playwright/test";
import {
	BASE,
	expectArea,
	hoverFarmTile,
	registerFast,
	rideTrain,
	uniqueName,
	useDoor,
	waitForTrainStop,
	waitForWorld,
	walkToProduceMarket,
	walkToSeedMarket,
	walkUntilPrompt,
	worldUrl,
} from "./helpers";

test("every world area loads without asset or page errors", async ({
	page,
}) => {
	const pageErrors: string[] = [];
	const failedAssets: string[] = [];

	page.on("pageerror", (error) => {
		pageErrors.push(error.message);
	});

	// Every image the world serves, not just the farm/marketplace/transport
	// sets: a scene that is missing an asset (for example after a lazy-loading
	// change) must fail here instead of drawing a blank sprite. Cached
	// navigations answer with 304, which is not `ok()` but is not a failure, and
	// the built JS/CSS/fonts also live under `/assets/`, so only 4xx/5xx image
	// responses count.
	page.on("response", (response) => {
		if (
			response.status() >= 400 &&
			/\/assets\/.*\.(?:webp|png|svg)$/.test(response.url())
		) {
			failedAssets.push(`${response.status()} ${response.url()}`);
		}
	});

	await registerFast(page, uniqueName("Sprout"));
	await expect(page.locator("canvas[aria-label^='Farm map']")).toBeVisible();

	// Each area boots its own scene and asset set.
	for (const area of [
		"marketplace",
		"casino",
		"livestock-market",
		"bank",
	] as const) {
		await page.goto(worldUrl(area));
		await waitForWorld(page);
	}
	await page.goto(worldUrl("farm-map"));
	await waitForWorld(page);

	expect(pageErrors).toEqual([]);
	expect(failedAssets).toEqual([]);
});

test("the market stalls open their buy and sell views", async ({ page }) => {
	await registerFast(page, uniqueName("Trader"), { area: "marketplace" });
	const prompt = page.getByTestId("travel-prompt");

	// Seed stall: the westernmost shop on the lane.
	await walkToSeedMarket(page);
	await expect(prompt).toContainText("enter the seed market");
	await useDoor(page);

	const market = page.getByTestId("market-window");
	await expect(market).toBeVisible();
	await expect(page.getByTestId("market-title")).toHaveText(
		"GRANGE MARKET - SEED STALL",
	);
	await expect(page.getByTestId("market-stall-seed")).toBeVisible();
	await expect(page.getByTestId("market-stall-produce")).toBeVisible();
	await expect(page.getByTestId("market-item-tomato-seed")).toContainText(
		"Tomato Seeds",
	);
	await expect(page.getByTestId("market-price-tomato-seed")).toContainText(
		"8 GC",
	);
	await expect(page.getByTestId("market-inventory-grid")).toBeVisible();
	// The numeric hotbar stays docked while the shop is open.
	await expect(page.getByTestId("slot-hotbar-1")).toHaveAttribute(
		"data-count",
		"10",
	);
	await expect(page.getByTestId("farm-balance")).toContainText("100");

	await page.getByTestId("market-buy-tomato-seed").click();
	await expect(page.getByTestId("farm-balance")).toContainText("92");
	// Seeds land in the tomato seed stack in the hotbar.
	await expect(page.getByTestId("slot-hotbar-1")).toHaveAttribute(
		"data-count",
		"11",
	);

	// The stalls swap with the buttons and with Tab.
	await page.getByTestId("market-stall-produce").click();
	await expect(page.getByTestId("market-title")).toHaveText(
		"GRANGE MARKET - PRODUCE STALL",
	);
	await page.keyboard.press("Tab");
	await expect(page.getByTestId("market-title")).toHaveText(
		"GRANGE MARKET - SEED STALL",
	);
	await page.keyboard.press("Escape");
	await expect(market).toHaveCount(0);
	await expect(prompt).toContainText("enter the seed market");

	// The produce stall is the next door east on the same lane.
	await walkUntilPrompt(page, ["d"], "enter the produce market", 20_000);
	await useDoor(page);
	await expect(market).toBeVisible();
	await expect(page.getByTestId("market-title")).toHaveText(
		"GRANGE MARKET - PRODUCE STALL",
	);
	await expect(page.getByTestId("market-subtab-sell")).toBeVisible();
	await expect(page.getByTestId("market-subtab-fish")).toBeVisible();
	await expect(page.getByTestId("market-subtab-rods")).toBeVisible();
	await expect(page.getByTestId("market-subtab-tools")).toBeVisible();
	await expect(page.getByTestId("market-subtab-train")).toBeVisible();
	await expect(page.getByTestId("market-item-tomato")).toContainText("TOMATO");
	await expect(page.getByTestId("market-item-midas_wheat")).toContainText(
		"MIDAS WHEAT",
	);
	await expect(page.getByTestId("market-stock-tomato")).toContainText(
		"STOCK: 0",
	);
	// Nothing harvested yet, so selling is unavailable.
	await expect(page.getByTestId("market-sell-tomato")).toBeDisabled();
	await expect(page.getByTestId("market-sellall-tomato")).toBeDisabled();

	// Secondary tabs keep the fish/rods/tools/train stock for now.
	await page.getByTestId("market-subtab-fish").click();
	await expect(page.locator(".market-generic-grid")).toBeVisible();
	await page.getByTestId("market-subtab-tools").click();
	await expect(page.locator(".market-generic-grid")).toBeVisible();

	await page.getByTestId("market-close").click();
	await expect(market).toHaveCount(0);

	// The purchase is account state, not a local bump that resets to 10 on load.
	await page.reload();
	await expect(page.getByTestId("slot-hotbar-1")).toHaveAttribute(
		"data-count",
		"11",
	);
});

test("the farm map is closed to visitors without a session", async ({
	page,
}) => {
	await page.goto("/world");

	await expect(page).toHaveURL("/");
	await expect(page.locator("canvas[aria-label^='Farm map']")).toHaveCount(0);
});

test("selling a harvested tomato credits the wallet", async ({ page }) => {
	await registerFast(page, uniqueName("Trader"));
	await expect(page).toHaveURL(/\/world$/);
	await expect(page.getByTestId("farm-hud")).toBeVisible();

	// Hoe, plant, and water the tile the player spawns on, then harvest it.
	const tiles = page.getByTestId("farm-map-tiles");
	const tile = page.getByTestId("farm-tile");
	await hoverFarmTile(page, 9, 9);
	await page.keyboard.press("1");
	await page.keyboard.press("Space");
	await expect(tiles).toHaveText("1 tiles");
	await expect(tile).toContainText("(9, 9): tilled");
	await page.keyboard.press("2");
	await page.keyboard.press("Space");
	await expect(tile).toContainText("(9, 9): planted");
	await page.keyboard.press("3");
	await page.keyboard.press("Space");
	// The e2e clock can ripen the tile before this assertion runs; `ready`
	// also proves the watering landed.
	await expect(tile).toContainText(/\(9, 9\): (?:watered|ready)/);

	// The e2e growth window is short (GRANGE_GROW_MS), then harvest one tomato.
	await expect(tile).toContainText("(9, 9): ready", { timeout: 20_000 });
	await page.keyboard.press("4");
	await page.keyboard.press("Space");
	await expect(page.getByTestId("farm-tomatoes")).toContainText("1");
	// The harvest lands in the first free hotbar slot after the tools.
	await expect(page.locator('[data-item="tomato"]')).toHaveAttribute(
		"data-count",
		"1",
	);

	// Travel to the marketplace and open the produce market.
	await walkUntilPrompt(page, ["d"], "board the train");
	await rideTrain(page, "marketplace");
	await expectArea(page, /^Marketplace map/);
	await waitForTrainStop(page);
	await walkToProduceMarket(page);
	await useDoor(page);

	const market = page.getByTestId("market-window");
	await expect(market).toBeVisible();
	await expect(page.getByTestId("market-stock-tomato")).toContainText(
		"STOCK: 1",
	);
	await expect(page.getByTestId("market-sell-tomato")).toBeEnabled();
	await expect(page.getByTestId("market-sellall-tomato")).toBeEnabled();

	// SELL ALL moves the whole stack for its crop value.
	await page.getByTestId("market-sellall-tomato").click();
	await expect(page.getByTestId("market-stock-tomato")).toContainText(
		"STOCK: 0",
	);
	await expect(page.getByTestId("farm-balance")).toContainText("105");
	await expect(page.getByTestId("market-sell-tomato")).toBeDisabled();
	await expect(page.getByTestId("market-sellall-tomato")).toBeDisabled();
	// Selling also clears it from the local inventory, so it can't linger.
	await page.getByTestId("market-close").click();
	await expect(page.locator('[data-item="tomato"]')).toHaveCount(0);
});

test("balance belongs to the account across a reload", async ({ page }) => {
	await registerFast(page, uniqueName("Saver"));
	await expect(page.getByTestId("farm-balance")).toContainText("100");

	// Spend through the server, the same call the client makes on a purchase.
	const spent = await page.request.post(`${BASE}/api/economy/transaction`, {
		data: { delta: -40 },
	});
	expect(spent.ok()).toBeTruthy();

	// A reload re-reads the stored balance from the account.
	await page.reload();
	await expect(page.getByTestId("farm-balance")).toContainText("60");
});
