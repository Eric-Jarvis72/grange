import { expect, test } from "@playwright/test";
import {
	register,
	resetServer,
	uniqueName,
	walkToCasino,
	walkUntilPrompt,
} from "./helpers";

test("the slot machine opens a playable sub-screen", async ({ page }) => {
	await resetServer();
	await register(page, uniqueName("Spinner"));

	const canvas = page.locator("canvas.farm-map-canvas");
	await page.waitForLoadState("networkidle");
	await walkToCasino(page);

	// Move into the aisle between the poker and blackjack tables, drop to the
	// bottom of the room, then sweep left into the row of slot machines.
	await page.keyboard.down("a");
	await page.waitForTimeout(1_050);
	await page.keyboard.up("a");
	await page.keyboard.down("s");
	await page.waitForTimeout(3_600);
	await page.keyboard.up("s");
	await walkUntilPrompt(page, ["a"], "play the slots");
	await page.keyboard.press("e");

	const overlay = page.getByTestId("slots-overlay");
	await expect(overlay).toBeVisible();
	await expect(page.getByTestId("slots-balance")).toContainText("100");

	// Pick the $50 spin and watch the reels settle into a result.
	await page.getByTestId("slots-bet-50").click();
	await expect(page.getByTestId("slots-current-bet")).toContainText("50");
	await page.getByTestId("slots-spin").click();
	await expect(page.getByTestId("slots-message")).toContainText("Spinning");
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

	// Closing the overlay hands control back to the paused world.
	await expect(page.getByTestId("slots-close")).toBeEnabled({ timeout: 10_000 });
	await page.getByTestId("slots-close").click();
	await expect(overlay).toHaveCount(0);
	await expect(canvas).toHaveAttribute("aria-label", /^Casino map/);
});
