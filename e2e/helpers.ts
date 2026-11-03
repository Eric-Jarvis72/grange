import { expect, type Page } from "@playwright/test";
import { MAP_COLUMNS, MAP_ROWS } from "../src/world/mapData";

export const BASE = process.env.E2E_BASE_URL ?? "http://localhost:3201";

/**
 * Budget for a train ride. Departure and arrival animate for two seconds of
 * game time, and a loaded runner still takes longer than wall clock to paint
 * those frames, so a ride gets a generous budget instead of Playwright's 5s
 * default. Scene-change assertions after a ride use this.
 */
export const TRAVEL_TIMEOUT = 30_000;

/** Unique suffix so tests don't collide with each other or prior runs. */
export function uniqueName(base: string): string {
	return `${base}-${Math.floor(Math.random() * 1e9)}`;
}

/**
 * Waits until the world route is actually interactive. The route renders
 * behind a session check, so the canvas/hotkeys come up a beat after the URL
 * changes.
 */
export async function waitForWorld(page: Page): Promise<void> {
	await page.locator("canvas.farm-map-canvas").waitFor({ state: "visible" });
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

/**
 * Registers through the auth API and lands on the farm map.
 *
 * `page.request` shares the context's cookie jar, so the session cookie set by
 * the response belongs to the page; the next navigation resolves it and the
 * socket handshake picks up the token. Use the UI `register` in auth tests —
 * everything else only needs an account, and the form costs a second per test.
 */
export async function registerFast(
	page: Page,
	username: string,
	password = "harvest-please",
): Promise<string> {
	const response = await page.request.post(`${BASE}/api/auth/register`, {
		data: { username, email: `${username}@example.test`, password },
	});
	if (!response.ok()) {
		throw new Error(
			`registering ${username} failed: ${response.status()} ${await response.text()}`,
		);
	}
	await page.goto(`${BASE}/world`);
	await waitForWorld(page);
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

/** How often a held walk re-sends its keydown while waiting. */
const HOLD_REPEAT_MS = 250;

/**
 * Reads the travel prompt without waiting for it to exist.
 *
 * `locator.textContent()` blocks until the element is attached, and the prompt
 * is only rendered while something is in reach — so polling with the locator
 * would stall the walk loop (and its timeout) whenever the player is between
 * prompts. `fallback` keeps the last non-null reading across a navigation.
 */
async function readTravelPrompt(
	page: Page,
	fallback: string | null,
): Promise<string | null> {
	return page
		.evaluate(() => {
			const prompt = document.querySelector('[data-testid="travel-prompt"]');
			return prompt?.textContent ?? null;
		})
		.catch(() => fallback);
}

/**
 * Presses the movement keys and keeps them held for `ms`.
 *
 * The keys are re-sent every `HOLD_REPEAT_MS` because a keydown delivered
 * while a scene is paused — right after an overlay closes — is dropped, which
 * would otherwise leave the player standing still for the whole hold.
 */
export async function holdKeys(
	page: Page,
	keys: string[],
	ms: number,
): Promise<void> {
	const deadline = Date.now() + ms;
	for (const key of keys) await page.keyboard.down(key);
	try {
		for (;;) {
			const left = deadline - Date.now();
			if (left <= 0) return;
			await page.waitForTimeout(Math.min(HOLD_REPEAT_MS, left));
			for (const key of keys) await page.keyboard.down(key);
		}
	} finally {
		for (const key of keys) await page.keyboard.up(key);
	}
}

/**
 * Holds the given movement keys until the travel prompt contains `text`, then
 * releases them. Polling while moving keeps navigation reliable on slow CI
 * runners, where a fixed hold covers less ground than it does locally, and the
 * hold is re-asserted so a keydown dropped during a scene transition cannot
 * strand the player.
 */
export async function walkUntilPrompt(
	page: Page,
	keys: string[],
	text: string,
	timeout = 10_000,
): Promise<void> {
	const deadline = Date.now() + timeout;
	for (const key of keys) await page.keyboard.down(key);
	try {
		let last: string | null = null;
		for (;;) {
			// Re-sending the hold is harmless and covers a dropped keydown.
			for (const key of keys) await page.keyboard.down(key);
			last = await readTravelPrompt(page, last);
			if (last?.includes(text)) return;
			if (Date.now() >= deadline) {
				throw new Error(
					`walking with ${JSON.stringify(keys)} never reached ${JSON.stringify(
						text,
					)} in ${timeout}ms; the prompt reads ${JSON.stringify(last)}`,
				);
			}
			await page.waitForTimeout(HOLD_REPEAT_MS);
		}
	} finally {
		for (const key of keys) await page.keyboard.up(key);
	}
}

/** Waits for the arriving train to park so the player can move again. The
 * spawn sits beside the train, so its boarding prompt appears once idle. */
export async function waitForTrainStop(
	page: Page,
	timeout = TRAVEL_TIMEOUT,
): Promise<void> {
	await expect(page.getByTestId("travel-prompt")).toContainText(
		"board the train",
		{ timeout },
	);
}

/**
 * Boards the parked train and picks a destination from the menu.
 * `destinationId` is a `TravelDestination.id` such as `marketplace`,
 * `home`, or `farm-Alice`.
 */
export async function rideTrain(
	page: Page,
	destinationId: string,
): Promise<void> {
	await page.keyboard.press("e");
	await page.getByTestId("travel-menu").waitFor({ state: "visible" });
	await page.getByTestId(`travel-option-${destinationId}`).click();
}

/**
 * Walks from the marketplace spawn to the seed market door.
 *
 * The shops share one front row: their fronts stop a northbound player at the
 * same height, and the lane just below that row runs clear all the way west to
 * the seed door. So the route is "north until the shop row, then west".
 *
 * The casino doorway sits on that row and is the only prompt on the climb, so
 * its prompt is the anchor that says the player is at the right height; a
 * short extra hold then puts the player in the lane (the shop fronts dead-end
 * both movements, so overshooting cannot miss the lane). A single timed north
 * hold is what used to break: on a loaded runner it covered less ground and
 * left the player below the lane, wedged on the produce cart.
 */
export async function walkToSeedMarket(
	page: Page,
	timeout = 20_000,
): Promise<void> {
	await walkUntilPrompt(page, ["w"], "enter the casino", TRAVEL_TIMEOUT);
	await holdKeys(page, ["w"], 1_500);
	await walkUntilPrompt(page, ["a"], "enter the seed market", timeout);
}

/** Walks from the farm spawn onto the marketplace platform. */
export async function enterMarketplace(page: Page): Promise<void> {
	const canvas = page.locator("canvas");

	// Hub specs drive two pages, so make sure this one owns the keyboard before
	// walking (Playwright's guidance for multi-page tests).
	await page.bringToFront();
	// Keep walking until the prompt appears rather than holding for a fixed
	// time: the map is wide, and a busy runner paints fewer frames per second,
	// so a timed hold covers less ground there than it does locally.
	await walkUntilPrompt(
		page,
		["d"],
		"board the train",
		TRAVEL_TIMEOUT,
	);
	await rideTrain(page, "marketplace");
	// The scene only switches once the train has finished departing, so allow a
	// loaded runner plenty of time (see TRAVEL_TIMEOUT).
	await expect(canvas).toHaveAttribute("aria-label", /^Marketplace map/, {
		timeout: TRAVEL_TIMEOUT,
	});
	await waitForTrainStop(page);
}

/** Walks from the farm spawn through the marketplace and into the casino. */
export async function walkToCasino(page: Page): Promise<void> {
	const canvas = page.locator("canvas");

	await enterMarketplace(page);

	await walkUntilPrompt(page, ["w"], "enter the casino", TRAVEL_TIMEOUT);
	await page.keyboard.press("e");
	await expect(canvas).toHaveAttribute("aria-label", /^Casino map/, {
		timeout: TRAVEL_TIMEOUT,
	});
}

/** Waits until the player's hub area lists `name` as another player. */
export async function waitForHubPeer(page: Page, name: string): Promise<void> {
	await expect
		.poll(async () => hubPeerList(page), { timeout: 10_000 })
		.toContain(name);
}

/** Waits until the player's hub area no longer lists `name`. */
export async function waitForHubPeerGone(
	page: Page,
	name: string,
): Promise<void> {
	await expect
		.poll(async () => hubPeerList(page), { timeout: 10_000 })
		.not.toContain(name);
}

/** The comma-separated peer names the world exposes for tests. */
export async function hubPeerList(page: Page): Promise<string> {
	const value = await page
		.locator(".farm-map-page")
		.getAttribute("data-hub-peers");
	return value ?? "";
}

/** Waits until the farm lists `name` as another person standing on it. */
export async function waitForFarmPeer(page: Page, name: string): Promise<void> {
	await expect
		.poll(async () => farmPeerList(page), { timeout: 15_000 })
		.toContain(name);
}

/** Waits until a farm no longer lists `name`. */
export async function waitForFarmPeerGone(
	page: Page,
	name: string,
): Promise<void> {
	await expect
		.poll(async () => farmPeerList(page), { timeout: 15_000 })
		.not.toContain(name);
}

/** The comma-separated visitor names a farm exposes for tests. */
export async function farmPeerList(page: Page): Promise<string> {
	const value = await page
		.locator(".farm-map-page")
		.getAttribute("data-farm-peers");
	return value ?? "";
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
