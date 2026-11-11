import { expect, type Page } from "@playwright/test";

/** The comma-separated `name:emote` list the world exposes for tests. */
export async function emoteList(page: Page): Promise<string> {
	const value = await page
		.locator(".farm-map-page")
		.getAttribute("data-emotes");
	return value ?? "";
}

/** Waits until the world lists a peer's recently played emote. */
export async function waitForEmote(
	page: Page,
	name: string,
	emote: string,
): Promise<void> {
	await expect
		.poll(async () => emoteList(page), { timeout: 10_000 })
		.toContain(`${name}:${emote}`);
}
