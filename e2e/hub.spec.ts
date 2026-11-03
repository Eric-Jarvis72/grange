import { expect, test } from "@playwright/test";
import {
	TRAVEL_TIMEOUT,
	enterMarketplace,
	hubPeerList,
	registerFast,
	uniqueName,
	waitForHubPeer,
	waitForHubPeerGone,
	walkUntilPrompt,
} from "./helpers";

test("players in the marketplace see each other", async ({ browser }) => {
	const aliceName = uniqueName("Alice");
	const bobName = uniqueName("Bob");
	const aliceContext = await browser.newContext();
	const bobContext = await browser.newContext();
	const alice = await aliceContext.newPage();
	const bob = await bobContext.newPage();

	try {
		await registerFast(alice, aliceName);
		await registerFast(bob, bobName);

		// Farms stay private: no peers are listed there.
		expect(await hubPeerList(alice)).toBe("");
		expect(await hubPeerList(bob)).toBe("");

		await enterMarketplace(alice);
		await enterMarketplace(bob);

		await waitForHubPeer(alice, bobName);
		await waitForHubPeer(bob, aliceName);
		// The local player is never their own peer.
		expect(await hubPeerList(alice)).not.toContain(aliceName);
	} finally {
		await aliceContext.close();
		await bobContext.close();
	}
});

test("the casino shows players in the casino, not the marketplace", async ({
	browser,
}) => {
	const aliceName = uniqueName("Alice");
	const bobName = uniqueName("Bob");
	const aliceContext = await browser.newContext();
	const bobContext = await browser.newContext();
	const alice = await aliceContext.newPage();
	const bob = await bobContext.newPage();

	try {
		await registerFast(alice, aliceName);
		await registerFast(bob, bobName);
		await enterMarketplace(alice);
		await enterMarketplace(bob);
		await waitForHubPeer(alice, bobName);

		// Bob leaves for the casino; he disappears from the marketplace.
		await bob.bringToFront();
		await walkUntilPrompt(bob, ["w"], "enter the casino");
		await bob.keyboard.press("e");
		await expect(bob.locator("canvas")).toHaveAttribute(
			"aria-label",
			/^Casino map/,
			{ timeout: TRAVEL_TIMEOUT },
		);

		await waitForHubPeerGone(alice, bobName);
		expect(await hubPeerList(bob)).toBe("");

		// Alice joins him and both are visible in the casino.
		await alice.bringToFront();
		await walkUntilPrompt(alice, ["w"], "enter the casino");
		await alice.keyboard.press("e");
		await expect(alice.locator("canvas")).toHaveAttribute(
			"aria-label",
			/^Casino map/,
			{ timeout: TRAVEL_TIMEOUT },
		);

		await waitForHubPeer(alice, bobName);
		await waitForHubPeer(bob, aliceName);
	} finally {
		await aliceContext.close();
		await bobContext.close();
	}
});
