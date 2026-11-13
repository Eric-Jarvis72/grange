import { expect, test } from "@playwright/test";
import {
	expectArea,
	holdKeys,
	registerFast,
	uniqueName,
	useDoor,
	walkUntilPrompt,
} from "./helpers";

/**
 * Each table is its own deep-linked test. Booting straight into the casino
 * keeps the navigation cost in `journey.spec.ts` instead of paying for it four
 * times, and one account per table keeps each wallet independent.
 */
const CASINO = { area: "casino" } as const;

test("blackjack deals a hand", async ({ page }) => {
	await registerFast(page, uniqueName("Dealer"), CASINO);

	// Blackjack sits straight down from the casino spawn.
	await walkUntilPrompt(page, ["s"], "play blackjack");
	await useDoor(page);

	const blackjack = page.getByTestId("blackjack-overlay");
	await expect(blackjack).toBeVisible();
	await expect(page.getByTestId("blackjack-balance")).toContainText("100");
	await expect(page.getByTestId("blackjack-deal")).toBeVisible();
	// Bet, deal, and confirm the player is dealt a hand.
	await page.getByTestId("blackjack-chip-25").click();
	await page.getByTestId("blackjack-deal").click();
	await expect(page.getByTestId("blackjack-player-hand")).toBeVisible();
	await page.getByTestId("blackjack-close").click();
	await expect(blackjack).toHaveCount(0);
	await expectArea(page, /^Casino map/, 5_000);
	// The scene resumes (and the prompt returns) once the overlay is gone.
	await expect(page.getByTestId("travel-prompt")).toContainText(
		"play blackjack",
	);
});

test("poker posts the blinds and deals hole cards", async ({ page }) => {
	await registerFast(page, uniqueName("Shark"), CASINO);

	// Poker is west of the blackjack table, but a diagonal walk slides along the
	// poker table's right edge just outside its 115px radius. Anchor the height
	// on the blackjack row first (its table stops the player), then walk west
	// along that row until the poker radius catches.
	await walkUntilPrompt(page, ["s"], "play blackjack", 20_000);
	await holdKeys(page, ["s"], 150);
	await walkUntilPrompt(page, ["a"], "play poker", 20_000);
	await useDoor(page);

	const poker = page.getByTestId("poker-overlay");
	await expect(poker).toBeVisible();
	await expect(page.getByTestId("poker-deal")).toBeVisible();
	await page.getByTestId("poker-deal").click();
	await expect(page.getByTestId("poker-pot")).toContainText("15");
	await expect(
		page.getByTestId("poker-player-hand").locator('[role="img"]'),
	).toHaveCount(2);
	await page.getByTestId("poker-close").click();
	await expect(poker).toHaveCount(0);
	await expect(page.getByTestId("travel-prompt")).toContainText("play poker");
});

test("roulette takes a bet and settles a spin", async ({ page }) => {
	await registerFast(page, uniqueName("Punter"), CASINO);

	// Roulette is east, past the blackjack table.
	await walkUntilPrompt(page, ["d", "s"], "play roulette", 20_000);
	await useDoor(page);

	const roulette = page.getByTestId("roulette-overlay");
	await expect(roulette).toBeVisible();
	await expect(page.getByTestId("roulette-spin")).toBeDisabled();
	// Place 5 on red and see the chip land on the felt.
	await page.getByTestId("roulette-spot-outside:red").click();
	await expect(page.getByTestId("roulette-bet-dialog")).toBeVisible();
	await page.getByTestId("roulette-dialog-chip-5").click();
	await page.getByTestId("roulette-confirm").click();
	await expect(page.getByTestId("roulette-chip-outside:red")).toContainText(
		"5",
	);
	await expect(page.getByTestId("roulette-staked")).toContainText("5");
	// Spin and wait for the wheel to settle into a result. The transient
	// "Spinning" label is not asserted: e2e shortens the animation, so the
	// settled result is the only stable signal.
	await page.getByTestId("roulette-spin").click();
	await expect(page.getByTestId("roulette-play-again")).toBeVisible({
		timeout: 8_000,
	});
	await expect(page.getByTestId("roulette-result")).not.toHaveText("—");
	await page.getByTestId("roulette-close").click();
	await expect(roulette).toHaveCount(0);
	await expect(page.getByTestId("travel-prompt")).toContainText(
		"play roulette",
	);
});

test("slots spin a bet and auto-spin several rounds", async ({ page }) => {
	await registerFast(page, uniqueName("Spinner"), CASINO);

	// Slots run along the bottom wall. The diagonal from spawn enters their
	// wide radius before reaching the bottom wall, so overshooting is harmless.
	await walkUntilPrompt(page, ["a", "s"], "play the slots", 20_000);
	await useDoor(page);

	const slots = page.getByTestId("slots-overlay");
	await expect(slots).toBeVisible();
	// Pick the $50 spin and watch the reels settle into a result.
	await page.getByTestId("slots-bet-50").click();
	await expect(page.getByTestId("slots-current-bet")).toContainText("50");
	await page.getByTestId("slots-spin").click();
	// The reels settle quickly in e2e; the settled result is the stable signal.
	await expect(page.getByTestId("slots-play-again")).toBeVisible({
		timeout: 8_000,
	});
	await expect(page.getByTestId("slots-reel-0")).toHaveAttribute(
		"data-symbol",
		/.+/,
	);
	// Auto-spin: drop to the $1 bet and let it run several rounds unattended.
	await page.getByTestId("slots-play-again").click();
	await page.getByTestId("slots-bet-1").click();
	await page.getByTestId("slots-auto").click();
	await expect(page.getByTestId("slots-auto")).toHaveAttribute(
		"aria-pressed",
		"true",
	);
	await page.waitForFunction(
		() => {
			const el = document.querySelector('[data-testid="slots-spin-count"]');
			return el !== null && Number(el.getAttribute("data-spins")) >= 3;
		},
		undefined,
		{ timeout: 20_000 },
	);
	await page.getByTestId("slots-auto").click();
	await expect(page.getByTestId("slots-auto")).toHaveAttribute(
		"aria-pressed",
		"false",
	);
	await expect(page.getByTestId("slots-close")).toBeEnabled({
		timeout: 10_000,
	});
	await page.getByTestId("slots-close").click();
	await expect(slots).toHaveCount(0);
	await expectArea(page, /^Casino map/, 5_000);
});
