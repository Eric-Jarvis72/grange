import { expect, test } from "@playwright/test";
import { BASE, register, resetServer, uniqueName } from "./helpers";

test("farm world loads without asset or page errors", async ({ page }) => {
	const pageErrors: string[] = [];
	const failedAssets: string[] = [];

	page.on("pageerror", (error) => {
		pageErrors.push(error.message);
	});

	page.on("response", (response) => {
		if (
			/\/assets\/(farm|marketplace|transport)\//.test(response.url()) &&
			!response.ok()
		) {
			failedAssets.push(response.url());
		}
	});

	await resetServer();
	await register(page, uniqueName("Sprout"));

	const canvas = page.locator("canvas[aria-label^='Farm map']");
	await expect(canvas).toBeVisible();

	await page.waitForLoadState("networkidle");

	expect(pageErrors).toEqual([]);
	expect(failedAssets).toEqual([]);
});

test("the train travels between the farm and marketplace", async ({ page }) => {
	await resetServer();
	await register(page, uniqueName("Traveler"));

	const canvas = page.locator("canvas");
	await expect(canvas).toHaveAttribute("aria-label", /^Farm map/);
	await page.waitForLoadState("networkidle");

	await page.keyboard.down("d");
	await page.waitForTimeout(1_000);
	await page.keyboard.up("d");

	const prompt = page.getByTestId("travel-prompt");
	await expect(prompt).toContainText("travel to the marketplace");
	await page.keyboard.press("e");

	await expect(canvas).toHaveAttribute("aria-label", /^Marketplace map/);
	await expect(prompt).toContainText("return to the farm");
	await page.keyboard.press("e");
	await expect(canvas).toHaveAttribute("aria-label", /^Farm map/);
});

test("the marketplace casino opens and returns outside", async ({ page }) => {
	await resetServer();
	await register(page, uniqueName("Highroller"));

	const canvas = page.locator("canvas");
	const prompt = page.getByTestId("travel-prompt");
	await page.waitForLoadState("networkidle");
	await page.keyboard.down("d");
	await page.waitForTimeout(1_000);
	await page.keyboard.up("d");
	await expect(prompt).toContainText("travel to the marketplace");
	await page.keyboard.press("e");
	await expect(canvas).toHaveAttribute("aria-label", /^Marketplace map/);

	await page.keyboard.down("w");
	await page.keyboard.down("d");
	await page.waitForTimeout(2_900);
	await page.keyboard.up("w");
	await page.keyboard.up("d");
	await page.keyboard.down("d");
	await page.waitForTimeout(1_200);
	await page.keyboard.up("d");

	await expect(prompt).toContainText("enter the casino");
	await page.keyboard.press("e");
	await expect(canvas).toHaveAttribute("aria-label", /^Casino map/);
	await expect(prompt).toContainText("leave the casino");

	await page.keyboard.press("e");
	await expect(canvas).toHaveAttribute("aria-label", /^Marketplace map/);
});

test("the seed market opens a window with a seeds tab", async ({ page }) => {
	await resetServer();
	await register(page, uniqueName("Seedseller"));

	const canvas = page.locator("canvas");
	const prompt = page.getByTestId("travel-prompt");
	await page.waitForLoadState("networkidle");
	await page.keyboard.down("d");
	await page.waitForTimeout(1_000);
	await page.keyboard.up("d");
	await expect(prompt).toContainText("travel to the marketplace");
	await page.keyboard.press("e");
	await expect(canvas).toHaveAttribute("aria-label", /^Marketplace map/);

	await page.keyboard.down("w");
	await page.keyboard.down("a");
	await page.waitForTimeout(2_800);
	await page.keyboard.up("w");
	await page.keyboard.up("a");

	await expect(prompt).toContainText("enter the seed market");
	await page.keyboard.press("e");

	const market = page.getByTestId("market-window");
	await expect(market).toBeVisible();
	await expect(page.getByTestId("market-title")).toHaveText("Seed Market");
	await expect(page.getByTestId("market-tab-seeds")).toBeVisible();
	await expect(page.getByTestId("market-item-tomato-seed")).toContainText(
		"Tomato Seeds",
	);
	await expect(page.getByTestId("market-owned-tomato-seed")).toContainText("10");
	// The grid has 8 cells; one is filled by the tomato seed card.
	await expect(page.getByTestId("market-slot")).toHaveCount(7);
	await expect(page.getByTestId("farm-balance")).toContainText("100");

	await page.getByTestId("market-action-tomato-seed").click();
	await expect(page.getByTestId("farm-balance")).toContainText("99");
	await expect(page.getByTestId("market-owned-tomato-seed")).toContainText("20");

	await page.keyboard.press("Escape");
	await expect(market).toHaveCount(0);
	await expect(prompt).toContainText("enter the seed market");
});

test("the produce market opens sell, tools, and train tabs", async ({
	page,
}) => {
	await resetServer();
	await register(page, uniqueName("Trader"));

	const prompt = page.getByTestId("travel-prompt");
	await page.waitForLoadState("networkidle");
	await page.keyboard.down("d");
	await page.waitForTimeout(1_000);
	await page.keyboard.up("d");
	await expect(prompt).toContainText("travel to the marketplace");
	await page.keyboard.press("e");
	await expect(page.locator("canvas")).toHaveAttribute(
		"aria-label",
		/^Marketplace map/,
	);

	await page.keyboard.down("w");
	await page.waitForTimeout(2_000);
	await page.keyboard.up("w");
	await page.keyboard.down("d");
	await page.waitForTimeout(1_000);
	await page.keyboard.up("d");

	await expect(prompt).toContainText("enter the produce market");
	await page.keyboard.press("e");

	const market = page.getByTestId("market-window");
	await expect(market).toBeVisible();
	await expect(page.getByTestId("market-title")).toHaveText("Produce Market");
	await expect(page.getByTestId("market-tab-sell")).toBeVisible();
	await expect(page.getByTestId("market-tab-tools")).toBeVisible();
	await expect(page.getByTestId("market-tab-train")).toBeVisible();
	await expect(page.getByTestId("market-item-tomato")).toContainText("Tomatoes");
	await expect(page.getByTestId("market-owned-tomato")).toContainText("0");
	// Nothing harvested yet, so selling is unavailable.
	await expect(page.getByTestId("market-action-tomato")).toBeDisabled();
	await expect(page.getByTestId("market-max-tomato")).toBeVisible();
	await expect(page.getByTestId("market-max-tomato")).toBeDisabled();
	// The grid has 12 cells; one is filled by the tomato card.
	await expect(page.getByTestId("market-slot")).toHaveCount(11);

	await page.getByTestId("market-tab-tools").click();
	await expect(page.getByTestId("market-slot")).toHaveCount(8);

	await page.getByTestId("market-tab-train").click();
	await expect(page.getByTestId("market-slot")).toHaveCount(6);

	await page.getByTestId("market-close").click();
	await expect(market).toHaveCount(0);
});

test("the farm map is closed to visitors without a session", async ({ page }) => {
	await resetServer();
	await page.goto("/world");

	await expect(page).toHaveURL("/");
	await expect(
		page.locator("canvas[aria-label^='Farm map']"),
	).toHaveCount(0);
});

test("farm world shows the starting balance HUD", async ({ page }) => {
	await resetServer();
	await register(page, uniqueName("Sprout"));

	const balance = page.getByTestId("farm-balance");
	await expect(balance).toBeVisible();
	await expect(balance).toContainText("100");
});

test("selling a chosen number of tomatoes uses the quantity stepper", async ({
	page,
}) => {
	await resetServer();
	await register(page, uniqueName("Trader"));
	await expect(page).toHaveURL(/\/world$/);
	await page.waitForLoadState("networkidle");
	await expect(page.getByTestId("farm-hud")).toBeVisible();

	// Hoe, plant, and water the tile the player spawns on, then harvest it.
	const tiles = page.getByTestId("farm-map-tiles");
	await page.keyboard.press("1");
	await page.keyboard.press("Space");
	await expect(tiles).toHaveText("1 tiles");
	await page.keyboard.press("2");
	await page.keyboard.press("Space");
	await page.keyboard.press("3");
	await page.keyboard.press("Space");

	// Wait out the 10s growth, then harvest for 3 tomatoes.
	await page.waitForTimeout(12_000);
	await page.keyboard.press("4");
	await page.keyboard.press("Space");
	await expect(page.getByTestId("farm-tomatoes")).toContainText("3");

	// Travel to the marketplace and open the produce market.
	await page.keyboard.down("d");
	await page.waitForTimeout(1_000);
	await page.keyboard.up("d");
	await page.keyboard.press("e");
	await expect(page.locator("canvas")).toHaveAttribute(
		"aria-label",
		/^Marketplace map/,
	);
	await page.keyboard.down("w");
	await page.waitForTimeout(2_000);
	await page.keyboard.up("w");
	await page.keyboard.down("d");
	await page.waitForTimeout(1_000);
	await page.keyboard.up("d");
	await page.keyboard.press("e");

	const market = page.getByTestId("market-window");
	await expect(market).toBeVisible();
	await expect(page.getByTestId("market-owned-tomato")).toContainText("3");

	// Sell exactly two of them.
	await page.getByTestId("market-inc-tomato").click();
	await expect(page.getByTestId("market-qty-tomato")).toHaveValue("2");
	await page.getByTestId("market-action-tomato").click();
	await expect(page.getByTestId("market-owned-tomato")).toContainText("1");
	await expect(page.getByTestId("farm-balance")).toContainText("102");

	// Max fills the stepper with everything left, then sells it.
	await page.getByTestId("market-max-tomato").click();
	await expect(page.getByTestId("market-qty-tomato")).toHaveValue("1");
	await page.getByTestId("market-action-tomato").click();
	await expect(page.getByTestId("market-owned-tomato")).toContainText("0");
	await expect(page.getByTestId("farm-balance")).toContainText("103");
	await expect(page.getByTestId("market-action-tomato")).toBeDisabled();
});

test("balance belongs to the account and starts fresh for a new one", async ({
	page,
}) => {
	await resetServer();
	await register(page, uniqueName("Saver"));
	await expect(page.getByTestId("farm-balance")).toContainText("100");

	// Spend through the server, the same call the client makes on a purchase.
	const spent = await page.request.post(`${BASE}/api/economy/transaction`, {
		data: { delta: -40 },
	});
	expect(spent.ok()).toBeTruthy();

	// A reload re-reads the stored balance from the account.
	await page.reload();
	await expect(page.getByTestId("farm-balance")).toContainText("60");

	// A different account must not inherit the first one's balance.
	await page.getByTestId("open-pause").click();
	await page.getByTestId("logout").click();
	await page.waitForURL(`${BASE}/`);
	await register(page, uniqueName("Fresh"));
	await expect(page.getByTestId("farm-balance")).toContainText("100");
});

test("the blackjack table opens a playable sub-screen", async ({ page }) => {
	await resetServer();
	await register(page, uniqueName("Cardcounter"));

	const canvas = page.locator("canvas");
	const prompt = page.getByTestId("travel-prompt");
	await page.waitForLoadState("networkidle");

	// Farm -> marketplace.
	await page.keyboard.down("d");
	await page.waitForTimeout(1_000);
	await page.keyboard.up("d");
	await expect(prompt).toContainText("travel to the marketplace");
	await page.keyboard.press("e");
	await expect(canvas).toHaveAttribute("aria-label", /^Marketplace map/);

	// Marketplace -> casino.
	await page.keyboard.down("w");
	await page.keyboard.down("d");
	await page.waitForTimeout(2_900);
	await page.keyboard.up("w");
	await page.keyboard.up("d");
	await page.keyboard.down("d");
	await page.waitForTimeout(1_200);
	await page.keyboard.up("d");
	await expect(prompt).toContainText("enter the casino");
	await page.keyboard.press("e");
	await expect(canvas).toHaveAttribute("aria-label", /^Casino map/);

	// Walk down to the blackjack table and open the sub-screen.
	await page.keyboard.down("s");
	await page.waitForTimeout(800);
	await page.keyboard.up("s");
	await expect(prompt).toContainText("play blackjack");
	await page.keyboard.press("e");

	const overlay = page.getByTestId("blackjack-overlay");
	await expect(overlay).toBeVisible();
	await expect(page.getByTestId("blackjack-balance")).toContainText("100");
	await expect(page.getByTestId("blackjack-deal")).toBeVisible();

	// Bet, deal, and confirm the player is dealt a hand.
	await page.getByTestId("blackjack-chip-25").click();
	await page.getByTestId("blackjack-deal").click();
	await expect(page.getByTestId("blackjack-player-hand")).toBeVisible();

	// Closing the overlay hands control back to the paused world.
	await page.getByTestId("blackjack-close").click();
	await expect(overlay).toHaveCount(0);
	await expect(canvas).toHaveAttribute("aria-label", /^Casino map/);
});
