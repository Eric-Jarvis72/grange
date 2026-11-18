import { type BrowserContext, test as base, type Page } from "@playwright/test";

interface MultiplayerFixtures {
	/**
	 * Creates two isolated browser contexts, each with its own session cookie.
	 *
	 * Both contexts are always closed when the test ends — including on failure
	 * — so a broken assertion cannot leak a browser into the next spec.
	 */
	twoPlayers: () => Promise<[Page, Page]>;
}

export const test = base.extend<MultiplayerFixtures>({
	twoPlayers: async ({ browser }, use) => {
		const contexts: BrowserContext[] = [];
		await use(async () => {
			const first = await openPlayer(() => browser.newContext(), contexts);
			const second = await openPlayer(() => browser.newContext(), contexts);
			return [first, second];
		});
		for (const context of contexts) await context.close();
	},
});

async function openPlayer(
	newContext: () => Promise<BrowserContext>,
	contexts: BrowserContext[],
): Promise<Page> {
	const context = await newContext();
	contexts.push(context);
	return context.newPage();
}
