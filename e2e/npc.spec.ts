import { expect, type Page, test } from "@playwright/test";
import { BASE, registerFast, uniqueName, walkUntilPrompt } from "./helpers";

/**
 * Seeds the signed-in player's quest/barn through the dev-only route. The
 * response is only a sanity check; the page picks the change up from the
 * `npcUpdate`/`farmUpdate` broadcasts.
 */
async function seedNpc(
	page: Page,
	body: {
		stage?: string;
		counters?: Record<string, number>;
		barn?: Record<string, number>;
	},
): Promise<void> {
	const response = await page.request.post(`${BASE}/api/dev/npc`, {
		data: body,
	});
	expect(response.ok(), await response.text()).toBe(true);
}

/** Presses E and waits for the farmhand window, retrying one dropped keypress. */
async function talkToNpc(page: Page): Promise<void> {
	const window = page.getByTestId("npc-window");
	await page.keyboard.press("e");
	try {
		await window.waitFor({ state: "visible", timeout: 2_000 });
	} catch {
		await page.keyboard.press("e");
		await window.waitFor({ state: "visible" });
	}
}

/** The stage attribute the farm page exposes for the owner's quest. */
function stage(page: Page) {
	return page.locator("main[data-npc-stage]");
}

test("farmhand walks the player through tomatoes, supplies, and farewell", async ({
	page,
}) => {
	test.setTimeout(120_000);
	// Walt's radius is crossed in about a frame at the e2e 3x speed, so walk at
	// production speed to read his prompt reliably.
	await registerFast(page, uniqueName("Hand"), { walk: "normal" });
	await expect(page).toHaveURL(/\/world(?:\?.*)?$/);
	await seedNpc(page, {
		stage: "intro",
		counters: { tomatoes: 0, lettuce: 0, wheat: 0 },
		barn: {},
	});

	// He stands beside the farmhouse, close enough that walking up reaches him
	// before the house prompt.
	await walkUntilPrompt(page, ["a", "w"], "talk to Walt", 20_000);
	await talkToNpc(page);

	// First talk is the welcome; dismissing it records the intro and continues
	// straight into the tomato order without leaving the conversation.
	await expect(stage(page)).toHaveAttribute("data-npc-stage", "intro");
	await expect(page.getByTestId("npc-dialogue")).toContainText(
		"Welcome to the Grange",
	);
	await expect(page.getByTestId("npc-sell-tomato")).toHaveCount(0);
	await page.getByTestId("npc-continue").click();
	await expect(stage(page)).toHaveAttribute("data-npc-stage", "tomatoes");
	await expect(page.getByTestId("npc-window")).toBeVisible();
	await expect(page.getByTestId("npc-dialogue")).toContainText("ten tomatoes");
	await expect(page.getByTestId("npc-progress-tomato")).toContainText(
		"0 / 10 handed in",
	);
	await expect(page.getByTestId("npc-sell-tomato")).toBeDisabled();

	// Esc still leaves the conversation once the order is showing, and a fresh
	// talk reopens it on the same stage.
	await page.keyboard.press("Escape");
	await expect(page.getByTestId("npc-window")).toHaveCount(0);
	await expect(stage(page)).toHaveAttribute("data-npc-stage", "tomatoes");
	await talkToNpc(page);
	await expect(page.getByTestId("npc-dialogue")).toContainText("ten tomatoes");

	// Ten tomatoes in the barn unlock the batch at market price.
	await seedNpc(page, { stage: "tomatoes", barn: { tomato: 10 } });
	await expect(page.getByTestId("npc-sell-tomato")).toBeEnabled();
	await expect(page.getByTestId("npc-sell-tomato")).toContainText("50 GC");

	const balance = page.getByTestId("npc-balance");
	await expect(balance).toContainText("100 GC");
	await page.getByTestId("npc-sell-tomato").click();

	// His thanks get their own screen before the lettuce/wheat menu appears.
	const npcWindow = page.getByTestId("npc-window");
	await expect(npcWindow).toHaveAttribute("data-npc-thanks", "tomato");
	await expect(page.getByTestId("npc-dialogue")).toContainText(
		"Thank you kindly",
	);
	await expect(balance).toContainText("150 GC");
	await expect(page.getByTestId("npc-buy-lettuce")).toHaveCount(0);

	await page.getByTestId("npc-thanks-continue").click();
	await expect(npcWindow).toHaveAttribute("data-npc-thanks", "none");
	await expect(stage(page)).toHaveAttribute("data-npc-stage", "supplies");
	// The tomato card is retired once its batch is in.
	await expect(page.getByTestId("npc-progress-tomato")).toHaveCount(0);

	// The second stage offers ten-seed bundles and wants both crops.
	await expect(page.getByTestId("npc-buy-lettuce")).toBeVisible();
	await expect(page.getByTestId("npc-buy-wheat")).toBeVisible();
	await expect(page.getByTestId("npc-sell-lettuce")).toBeDisabled();
	await expect(page.getByTestId("npc-sell-wheat")).toBeDisabled();

	await page.getByTestId("npc-buy-lettuce").click();
	await expect(page.getByTestId("npc-message")).toContainText(
		"Bought 10 lettuce seeds",
	);
	await expect(balance).toContainText("110 GC");

	// Hand in both ten-crop batches one at a time.
	await seedNpc(page, {
		stage: "supplies",
		counters: { tomatoes: 10 },
		barn: { lettuce: 10, wheat: 10 },
	});
	await expect(page.getByTestId("npc-sell-lettuce")).toBeEnabled();
	await page.getByTestId("npc-sell-lettuce").click();
	await expect(page.getByTestId("npc-message")).toContainText("ten wheat");
	await expect(page.getByTestId("npc-sell-wheat")).toBeEnabled();
	await page.getByTestId("npc-sell-wheat").click();
	await expect(page.getByTestId("npc-message")).toContainText("market");
	await expect(stage(page)).toHaveAttribute("data-npc-stage", "complete");

	// The final line stays readable while he says goodbye, then he is gone. The
	// player is standing close enough to the farmhouse as well, so only his own
	// prompt has to disappear.
	await page.getByTestId("npc-done").click();
	await expect(page.getByTestId("npc-window")).toHaveCount(0);
	await expect(
		page.getByTestId("travel-prompt").filter({ hasText: "talk to Walt" }),
	).toHaveCount(0);

	// Reloading keeps him gone: the quest is persisted server-side.
	await page.reload();
	await expect(page.locator("main[data-world-ready='true']")).toBeVisible();
	await expect(stage(page)).toHaveAttribute("data-npc-stage", "complete");
});
