import { expect } from "@playwright/test";
import {
	multiplayerTest as test,
	registerFast,
	uniqueName,
	waitForEmote,
	waitForHubPeer,
} from "./helpers";

test("players see each other's emotes in a hub", async ({ twoPlayers }) => {
	test.setTimeout(120_000);

	const [emoter, watcher] = await twoPlayers();
	const emoterName = uniqueName("Emoter");
	const watcherName = uniqueName("Watcher");

	await registerFast(emoter, emoterName, { area: "marketplace" });
	await registerFast(watcher, watcherName, { area: "marketplace" });

	await waitForHubPeer(emoter, watcherName);
	await waitForHubPeer(watcher, emoterName);

	await emoter.keyboard.press("t");
	await expect(emoter.getByTestId("emote-wheel")).toBeVisible();
	await emoter.getByTestId("emote-wave").click();
	await expect(emoter.getByTestId("emote-wheel")).toHaveCount(0);

	await waitForEmote(watcher, emoterName, "wave");
});
