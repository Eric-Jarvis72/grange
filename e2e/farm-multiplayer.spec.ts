import { expect } from "@playwright/test";
import {
	BASE,
	clickFarmTile,
	registerFast,
	rideTrain,
	TRAVEL_TIMEOUT,
	multiplayerTest as test,
	uniqueName,
	waitForFarmPeer,
	waitForWorld,
	walkUntilPrompt,
} from "./helpers";

test("farmhouse settings control visitors and farm presence", async ({
	twoPlayers,
}) => {
	// Two browser contexts sharing four vCPUs with the other workers: the
	// default 90s budget is tight when the runner is busy, and a timeout here
	// aborts an otherwise-healthy run.
	test.setTimeout(180_000);

	const [owner, guest] = await twoPlayers();
	const ownerName = uniqueName("Owner");
	const guestName = uniqueName("Guest");

	await registerFast(owner, ownerName);

	// The owner opens the farmhouse menu by standing beside the house.
	await walkUntilPrompt(owner, ["a", "w"], "enter the farmhouse", 20_000);
	await owner.keyboard.press("e");
	const menu = owner.getByTestId("house-menu");
	await expect(menu).toBeVisible();

	await owner.getByTestId("house-visibility-toggle").click();
	await expect(owner.getByTestId("house-visibility-toggle")).toContainText(
		"Public",
	);
	await owner.getByTestId("house-edit-toggle").click();
	await expect(owner.getByTestId("house-edit-toggle")).toContainText("On");
	await owner.getByTestId("house-close").click();
	await expect(menu).toHaveCount(0);

	// The guest finds the now-public farm in the train menu.
	await registerFast(guest, guestName);
	await walkUntilPrompt(guest, ["d"], "board the train", TRAVEL_TIMEOUT);
	await rideTrain(guest, `farm-${ownerName}`);
	await expect(guest).toHaveURL(new RegExp(`/farms/${ownerName}$`), {
		timeout: TRAVEL_TIMEOUT,
	});
	await waitForWorld(guest);

	await waitForFarmPeer(guest, ownerName);
	await waitForFarmPeer(owner, guestName);

	// With editing on, the visitor can till a tile on the owner's farm.
	await guest.keyboard.press("1");
	await clickFarmTile(guest, 9, 9);
	await expect(guest.getByTestId("farm-map-tiles")).toHaveText("1 tiles");
	await expect(guest.getByTestId("farm-tile")).toContainText("(9, 9): tilled");
	await expect(owner.getByTestId("farm-map-tiles")).toHaveText("1 tiles");

	// Revoking editing blocks the visitor's very next action.
	await owner.keyboard.press("e");
	await expect(menu).toBeVisible();
	await owner.getByTestId("house-edit-toggle").click();
	await expect(owner.getByTestId("house-edit-toggle")).toContainText("Off");
	await owner.getByTestId("house-close").click();

	await clickFarmTile(guest, 8, 9);
	await expect(guest.getByTestId("farm-hint")).toContainText(
		"visitor editing off",
	);
	await expect(guest.getByTestId("farm-map-tiles")).toHaveText("1 tiles");

	// Going private stops new joins but never kicks someone already inside.
	await owner.keyboard.press("e");
	await expect(menu).toBeVisible();
	await owner.getByTestId("house-visibility-toggle").click();
	await expect(owner.getByTestId("house-visibility-toggle")).toContainText(
		"Private",
	);
	await owner.getByTestId("house-close").click();

	await expect(guest.locator("canvas")).toHaveAttribute(
		"aria-label",
		/^Farm map/,
	);
	await waitForFarmPeer(guest, ownerName);

	// Private farms stay out of the dashboard's open-farm list.
	await guest.goto(`${BASE}/dashboard`);
	await expect(guest.getByText(ownerName)).toHaveCount(0);
});
