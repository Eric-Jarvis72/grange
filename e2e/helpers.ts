import { expect, type Page } from "@playwright/test";
import { MAP_COLUMNS, MAP_ROWS } from "../src/world/mapData";

export const BASE = process.env.E2E_BASE_URL ?? "http://localhost:3201";

/** Unique suffix so tests don't collide with each other or prior runs. */
export function uniqueName(base: string): string {
	return `${base}-${Math.floor(Math.random() * 1e9)}`;
}

/** Resets the server's in-memory state so each test starts clean. */
export async function resetServer(): Promise<void> {
	await fetch(`${BASE}/api/reset`, { method: "POST" });
}

/**
 * Waits until the world route is actually interactive. The route renders
 * behind a session check, so the canvas/hotkeys come up a beat after the URL
 * changes.
 */
export async function waitForWorld(page: Page): Promise<void> {
	await page.locator("canvas.farm-map-canvas").waitFor({ state: "visible" });
	await page.waitForLoadState("networkidle");
	// The Excalibur engine starts asynchronously after the canvas mounts, so
	// wait for the world to report that it is actually interactive before any
	// keyboard-driven test acts on it.
	await page
		.locator('.farm-map-page[data-world-ready="true"]')
		.waitFor({ state: "attached" });
}

/** Continues from the main menu into the farm and waits for it to be live. */
export async function enterFarm(page: Page): Promise<void> {
	await page.getByRole("button", { name: /Continue \/ Load Farm/i }).click();
	await page.waitForURL("**/world");
	await waitForWorld(page);
}

/**
 * Registers a fresh account and leaves the page on the main menu, signed in.
 * `/api/reset` wipes accounts too, so the username only has to be unique
 * within a test.
 */
export async function registerAccount(
	page: Page,
	username: string,
	password = "harvest-please",
): Promise<string> {
	await page.goto(`${BASE}/login`);
	await page.getByTestId("toggle-mode").click();
	await page.getByTestId("username").fill(username);
	await page.getByTestId("email").fill(`${username}@example.test`);
	await page.getByTestId("password").fill(password);
	await page.getByRole("button", { name: /Create Account/i }).click();
	await page.waitForURL(`${BASE}/`);
	await page.getByTestId("menu-user").waitFor();
	return username;
}

/**
 * Registers a fresh account and continues into the farm, leaving the page on
 * the farm map. Most tests start here.
 */
export async function register(
	page: Page,
	username: string,
	password = "harvest-please",
): Promise<string> {
	await registerAccount(page, username, password);
	await enterFarm(page);
	return username;
}

/** Registers an account then signs in, leaving the page on the farm map. */
export async function login(
	page: Page,
	username: string,
	password = "harvest-please",
): Promise<void> {
	await registerAccount(page, username, password);
	// Sign out from the menu, then sign back in from the login screen.
	await page.getByTestId("menu-logout").click();
	await page.getByTestId("menu-login").click();
	await page.waitForURL("**/login");
	await page.getByTestId("username").fill(username);
	await page.getByTestId("password").fill(password);
	await page.getByRole("button", { name: /Sign In/i }).click();
	await page.waitForURL(`${BASE}/`);
	await page.getByTestId("menu-user").waitFor();
	await enterFarm(page);
}

/**
 * Holds the given movement keys until the travel prompt contains `text`, then
 * releases them. Polling while moving keeps navigation reliable on slow CI
 * runners: Excalibur clamps per-frame delta, so a fixed hold covers less
 * ground there and the player can stop short of the interaction radius.
 */
export async function walkUntilPrompt(
	page: Page,
	keys: string[],
	text: string,
	timeout = 10_000,
): Promise<void> {
	const prompt = page.getByTestId("travel-prompt");
	for (const key of keys) await page.keyboard.down(key);
	try {
		await expect(prompt).toContainText(text, { timeout });
	} finally {
		for (const key of keys) await page.keyboard.up(key);
	}
}

/** Waits for the arriving train to park so the player can move again. The
 * marketplace spawn sits beside the train, so its prompt appears once idle. */
export async function waitForTrainStop(page: Page): Promise<void> {
	await expect(page.getByTestId("travel-prompt")).toContainText(
		"return to the farm",
	);
}

/**
 * Walks from the marketplace spawn to the seed market door. Heads north first
 * into the clear lane between the shop fronts (bottom y=300) and the stall
 * tops (y~450), then walks straight west until the seed prompt shows. A
 * straight-west walk avoids wedging diagonally into the produce-cart/barrel
 * row and ends stopped inside the prompt radius instead of streaking through
 * it on a diagonal.
 */
export async function walkToSeedMarket(
	page: Page,
	timeout = 20_000,
): Promise<void> {
	await page.keyboard.down("w");
	await page.waitForTimeout(1_300);
	await page.keyboard.up("w");
	await walkUntilPrompt(page, ["a"], "enter the seed market", timeout);
}

/** Walks from the farm spawn through the marketplace and into the casino. */
export async function walkToCasino(page: Page): Promise<void> {
	const canvas = page.locator("canvas");
	const prompt = page.getByTestId("travel-prompt");

	await page.keyboard.down("d");
	await page.waitForTimeout(1_000);
	await page.keyboard.up("d");
	await expect(prompt).toContainText("travel to the marketplace");
	await page.keyboard.press("e");
	await expect(canvas).toHaveAttribute("aria-label", /^Marketplace map/);
	await waitForTrainStop(page);

	await walkUntilPrompt(page, ["w"], "enter the casino");
	await page.keyboard.press("e");
	await expect(canvas).toHaveAttribute("aria-label", /^Casino map/);
}

/**
 * The page-space center of a farm map tile (0-based map coordinates).
 * Excalibur's FitContainer keeps the canvas at the map's aspect ratio, so the
 * center is a simple fraction of the canvas box. `MAP_COLUMNS`/`MAP_ROWS` come
 * from the same data the game renders with, so the click math can't drift away
 * from the real grid when tiles are redrawn or the layout is restyled.
 */
export async function farmTilePosition(
	page: Page,
	column: number,
	row: number,
): Promise<{ x: number; y: number }> {
	const box = await page.locator("canvas.farm-map-canvas").boundingBox();
	expect(box).not.toBeNull();
	return {
		x: box!.x + ((column + 0.5) / MAP_COLUMNS) * box!.width,
		y: box!.y + ((row + 0.5) / MAP_ROWS) * box!.height,
	};
}

/** Moves the pointer over the center of a farm map tile. */
export async function hoverFarmTile(
	page: Page,
	column: number,
	row: number,
): Promise<void> {
	const { x, y } = await farmTilePosition(page, column, row);
	await page.mouse.move(x, y);
}

/** Clicks the center of a farm map tile. */
export async function clickFarmTile(
	page: Page,
	column: number,
	row: number,
): Promise<void> {
	const { x, y } = await farmTilePosition(page, column, row);
	await page.mouse.click(x, y);
}

/** Samples a rendered farm tile's center pixel from a canvas screenshot. */
export async function farmTilePixel(
	page: Page,
	column: number,
	row: number,
): Promise<{ r: number; g: number; b: number }> {
	const buf = await page.locator("canvas.farm-map-canvas").screenshot();
	const b64 = buf.toString("base64");
	return page.evaluate(
		async ({ b64, xf, yf }) => {
			const img = new Image();
			img.src = `data:image/png;base64,${b64}`;
			await img.decode();
			const canvas = document.createElement("canvas");
			canvas.width = img.width;
			canvas.height = img.height;
			const ctx = canvas.getContext("2d")!;
			ctx.drawImage(img, 0, 0);
			const d = ctx.getImageData(
				Math.floor(xf * img.width),
				Math.floor(yf * img.height),
				1,
				1,
			).data;
			return { r: d[0], g: d[1], b: d[2] };
		},
		{ b64, xf: (column + 0.5) / MAP_COLUMNS, yf: (row + 0.5) / MAP_ROWS },
	);
}
