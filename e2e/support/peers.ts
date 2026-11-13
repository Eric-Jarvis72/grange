import { expect, type Page } from "@playwright/test";

/** The comma-separated peer names the world exposes for tests. */
export async function hubPeerList(page: Page): Promise<string> {
	const value = await page
		.locator(".farm-map-page")
		.getAttribute("data-hub-peers");
	return value ?? "";
}

/** Waits until the player's hub area lists `name` as another player. */
export async function waitForHubPeer(page: Page, name: string): Promise<void> {
	await expect
		.poll(async () => hubPeerList(page), { timeout: 10_000 })
		.toContain(name);
}

/** Waits until the player's hub area no longer lists `name`. */
export async function waitForHubPeerGone(
	page: Page,
	name: string,
): Promise<void> {
	await expect
		.poll(async () => hubPeerList(page), { timeout: 10_000 })
		.not.toContain(name);
}

/** The comma-separated visitor names a farm exposes for tests. */
export async function farmPeerList(page: Page): Promise<string> {
	const value = await page
		.locator(".farm-map-page")
		.getAttribute("data-farm-peers");
	return value ?? "";
}

/** Waits until the farm lists `name` as another person standing on it. */
export async function waitForFarmPeer(page: Page, name: string): Promise<void> {
	await expect
		.poll(async () => farmPeerList(page), { timeout: 15_000 })
		.toContain(name);
}

/** Waits until a farm no longer lists `name`. */
export async function waitForFarmPeerGone(
	page: Page,
	name: string,
): Promise<void> {
	await expect
		.poll(async () => farmPeerList(page), { timeout: 15_000 })
		.not.toContain(name);
}
