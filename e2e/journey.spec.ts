import { expect, test } from "@playwright/test";
import {
	BASE,
	expectArea,
	registerFast,
	rideTrain,
	uniqueName,
	useDoor,
	waitForTrainStop,
	walkUntilPrompt,
} from "./helpers";

/**
 * The one test that keeps the real navigation loop honest: board the train,
 * cross to the marketplace, walk through the casino doorway and back out, then
 * ride home. Feature specs boot straight into their scene, so this is where
 * walking, prompts, and train departure/arrival stay covered end to end.
 */
test("a full trip: farm, marketplace, casino, and home", async ({ page }) => {
	await registerFast(page, uniqueName("Traveler"));
	await expect(page).toHaveURL(/\/world$/);
	await expectArea(page, /^Farm map/, 10_000);

	await walkUntilPrompt(page, ["d"], "board the train");
	await rideTrain(page, "marketplace");
	await expectArea(page, /^Marketplace map/);
	await waitForTrainStop(page);

	// The casino doorway is a short climb north of the train stop.
	await walkUntilPrompt(page, ["w"], "enter the casino");
	await useDoor(page);
	await expectArea(page, /^Casino map/, 10_000);
	// The exit sits just above the spawn, so leaving is one more press.
	await expect(page.getByTestId("travel-prompt")).toContainText(
		"leave the casino",
	);
	await useDoor(page);
	await expectArea(page, /^Marketplace map/, 10_000);

	// Ride back home from the marketplace platform.
	await walkUntilPrompt(page, ["s"], "board the train");
	await rideTrain(page, "home");
	await expectArea(page, /^Farm map/, 30_000);
	await expect(page).toHaveURL(new RegExp(`${BASE}/world$`));
});
