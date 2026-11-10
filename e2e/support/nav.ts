import { expect, type Page } from "@playwright/test";
import type { WorldSceneName } from "../../src/world/WalkingScene";

/**
 * Budget for a train ride. Departure and arrival animate for two seconds of
 * game time, and a loaded runner still takes longer than wall clock to paint
 * those frames, so a ride gets a generous budget instead of Playwright's 5s
 * default. Scene-change assertions after a ride use this.
 */
export const TRAVEL_TIMEOUT = 30_000;

/** How often a held walk re-sends its keydown while waiting. */
const HOLD_REPEAT_MS = 250;

/**
 * How often a walk re-reads the prompt.
 *
 * Polling must be much faster than the key resend: movement keeps going while
 * the loop waits, and e2e runs walk at triple speed. Neighbouring interaction
 * radii can overlap (the casino's poker and slot radii do), so a quarter second
 * of extra walking can carry the player out of the prompt it just matched.
 */
const POLL_MS = 40;

/** Asserts the world is showing `area`'s scene. */
export async function expectArea(
	page: Page,
	label: RegExp,
	timeout = TRAVEL_TIMEOUT,
): Promise<void> {
	await expect(page.locator("canvas")).toHaveAttribute("aria-label", label, {
		timeout,
	});
}

/**
 * The `KeyboardEvent.code` for a single-character movement key, which is what
 * the world's input manager listens for.
 */
function keyCode(key: string): string {
	return key.length === 1 ? `Key${key.toUpperCase()}` : key;
}

/**
 * Reads the travel prompt, and — when it already names the goal — releases the
 * movement keys in the same round trip.
 *
 * `locator.textContent()` blocks until the element is attached, and the prompt
 * is only rendered while something is in reach, so the loop polls the DOM
 * directly. Releasing inside that same evaluate matters: the canvas runs at a
 * handful of frames per second on a loaded runner, and a key release sent over
 * the wire afterwards lands several frames later — long enough to walk out of a
 * neighbouring interaction radius (the casino's poker and slot radii overlap).
 * `fallback` keeps the last non-null reading across a navigation.
 */
async function pollTravelPrompt(
	page: Page,
	codes: string[],
	target: string,
	fallback: string | null,
): Promise<string | null> {
	return page
		.evaluate(
			({ codes, target }) => {
				const prompt = document.querySelector('[data-testid="travel-prompt"]');
				const text = prompt?.textContent ?? null;
				if (text?.includes(target)) {
					// The scene reads held keys from window keyups, and a keyup
					// only takes effect on the next frame, so send them before
					// the frame that would carry the player further.
					for (const code of codes) {
						window.dispatchEvent(new KeyboardEvent("keyup", { code }));
					}
				}
				return text;
			},
			{ codes, target },
		)
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
 * stops the player. Polling while moving keeps navigation reliable on slow CI
 * runners, where a fixed hold covers less ground than it does locally, and the
 * hold is re-asserted so a keydown dropped during a scene transition cannot
 * strand the player.
 *
 * The stop happens inside the polling evaluate (see `pollTravelPrompt`), so the
 * player is standing still in the interaction radius when this resolves.
 */
export async function walkUntilPrompt(
	page: Page,
	keys: string[],
	text: string,
	timeout = 10_000,
): Promise<void> {
	const deadline = Date.now() + timeout;
	const codes = keys.map(keyCode);
	for (const key of keys) await page.keyboard.down(key);
	try {
		let last: string | null = null;
		let resendAt = 0;
		for (;;) {
			// Re-sending the hold is harmless and covers a dropped keydown.
			if (Date.now() >= resendAt) {
				for (const key of keys) await page.keyboard.down(key);
				resendAt = Date.now() + HOLD_REPEAT_MS;
			}
			last = await pollTravelPrompt(page, codes, text, last);
			if (last?.includes(text)) return;
			if (Date.now() >= deadline) {
				throw new Error(
					`walking with ${JSON.stringify(keys)} never reached ${JSON.stringify(
						text,
					)} in ${timeout}ms; the prompt reads ${JSON.stringify(last)}`,
				);
			}
			await page.waitForTimeout(POLL_MS);
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
 * Walks from the marketplace spawn onto the shop lane, just north of the row
 * of shop fronts. The casino doorway is the only prompt on the climb, so it
 * anchors the height; the shop fronts dead-end both movements, so a short
 * extra hold cannot overshoot the lane.
 */
async function reachShopLane(page: Page): Promise<void> {
	await walkUntilPrompt(page, ["w"], "enter the casino", TRAVEL_TIMEOUT);
	// About the ground the old one-second hold covered at 2x walking (320px),
	// now at 3x. The shop fronts dead-end the climb, so a little extra cannot
	// overshoot the lane.
	await holdKeys(page, ["w"], 700);
}

/**
 * Walks from the marketplace spawn to the seed market door, the westernmost
 * shop on the row.
 */
export async function walkToSeedMarket(
	page: Page,
	timeout = 20_000,
): Promise<void> {
	await reachShopLane(page);
	await walkUntilPrompt(page, ["a"], "enter the seed market", timeout);
}

/** Walks from the marketplace spawn to the produce market door. */
export async function walkToProduceMarket(
	page: Page,
	timeout = 20_000,
): Promise<void> {
	await reachShopLane(page);
	await walkUntilPrompt(page, ["a"], "enter the produce market", timeout);
}

/**
 * Walks from the farm spawn onto the marketplace platform.
 *
 * Hub specs drive two pages, so this brings the page to the front before
 * pressing keys (Playwright's guidance for multi-page tests).
 */
export async function enterMarketplace(page: Page): Promise<void> {
	await page.bringToFront();
	// Keep walking until the prompt appears rather than holding for a fixed
	// time: the map is wide, and a busy runner paints fewer frames per second,
	// so a timed hold covers less ground there than it does locally.
	await walkUntilPrompt(page, ["d"], "board the train", TRAVEL_TIMEOUT);
	await rideTrain(page, "marketplace");
	// The scene only switches once the train has finished departing, so allow a
	// loaded runner plenty of time (see TRAVEL_TIMEOUT).
	await expectArea(page, /^Marketplace map/);
	await waitForTrainStop(page);
}

/** Walks from the farm spawn through the marketplace and into the casino. */
export async function walkToCasino(page: Page): Promise<void> {
	await enterMarketplace(page);
	await walkUntilPrompt(page, ["w"], "enter the casino", TRAVEL_TIMEOUT);
	await page.keyboard.press("e");
	await expectArea(page, /^Casino map/);
}

/** Walks from the marketplace spawn to the hardware stall. */
export async function walkToHardwareStore(page: Page): Promise<void> {
	await reachShopLane(page);
	await walkUntilPrompt(page, ["d"], "shop at the hardware store");
}

/** Walks from the marketplace spawn to the bank door. */
export async function walkToBank(page: Page): Promise<void> {
	await walkUntilPrompt(page, ["d"], "enter the bank", 15_000);
}

/** Walks from the marketplace spawn to the livestock market door. */
export async function walkToLivestock(page: Page): Promise<void> {
	await walkUntilPrompt(page, ["a"], "enter the livestock market");
}

/** Opens the door under the current prompt by pressing E. */
export async function useDoor(page: Page): Promise<void> {
	await page.keyboard.press("e");
}

/** Asserts the world shows a scene, as a readable failure at the call site. */
export function sceneLabel(area: WorldSceneName): RegExp {
	const labels: Record<WorldSceneName, RegExp> = {
		"farm-map": /^Farm map/,
		marketplace: /^Marketplace map/,
		casino: /^Casino map/,
		"livestock-market": /^Livestock Market map/,
		bank: /^Bank map/,
	};
	return labels[area];
}
