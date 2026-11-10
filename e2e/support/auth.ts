import type { Page } from "@playwright/test";
import type { WorldSceneName } from "../../src/world/WalkingScene";

export const BASE = process.env.E2E_BASE_URL ?? "http://localhost:3201";

/** Password every helper makes up accounts with. */
export const TEST_PASSWORD = "harvest-please";

/** Unique suffix so tests don't collide with each other or prior runs. */
export function uniqueName(base: string): string {
	return `${base}-${Math.floor(Math.random() * 1e9)}`;
}

/**
 * The world URL for an optional deep-link boot scene.
 *
 * `?area=` is only honored by the SPA when the Phoenix shell injected the
 * dev-only test-route meta tag, so normal play still starts on the farm.
 */
export function worldUrl(area?: WorldSceneName): string {
	return area ? `${BASE}/world?area=${area}` : `${BASE}/world`;
}

/**
 * Waits until the world route is actually interactive. The route renders
 * behind a session check, so the canvas/hotkeys come up a beat after the URL
 * changes.
 */
export async function waitForWorld(page: Page): Promise<void> {
	await page.locator("canvas.farm-map-canvas").waitFor({ state: "visible" });
	// The Excalibur engine starts asynchronously after the canvas mounts, so
	// wait for the world to report that it is actually interactive before any
	// keyboard-driven test acts on it.
	await page
		.locator('.farm-map-page[data-world-ready="true"]')
		.waitFor({ state: "attached" });
}

/** Continues from the main menu into the farm and waits for it to be live. */
export async function enterFarm(page: Page): Promise<void> {
	await page.getByRole("button", { name: /Continue \/ Load Farm/i }).click();
	await page.waitForURL("**/world");
	await waitForWorld(page);
}

/**
 * Registers a fresh account and leaves the page on the main menu, signed in.
 * `/api/reset` wipes accounts too, so the username only has to be unique
 * within a test.
 */
export async function registerAccount(
	page: Page,
	username: string,
	password = TEST_PASSWORD,
): Promise<string> {
	await page.goto(`${BASE}/login`);
	await page.getByTestId("toggle-mode").click();
	await page.getByTestId("username").fill(username);
	await page.getByTestId("email").fill(`${username}@example.test`);
	await page.getByTestId("password").fill(password);
	await page.getByRole("button", { name: /Create Account/i }).click();
	await page.waitForURL(`${BASE}/`);
	await page.getByTestId("menu-user").waitFor();
	return username;
}

/**
 * Registers a fresh account and continues into the farm, leaving the page on
 * the farm map. Most tests start here.
 */
export async function register(
	page: Page,
	username: string,
	password = TEST_PASSWORD,
): Promise<string> {
	await registerAccount(page, username, password);
	await enterFarm(page);
	return username;
}

export interface RegisterFastOptions {
	password?: string;
	/** Boot straight into this scene instead of the farm (dev-only hook). */
	area?: WorldSceneName;
}

/**
 * Registers through the auth API and lands in the world.
 *
 * `page.request` shares the context's cookie jar, so the session cookie set by
 * the response belongs to the page; the next navigation resolves it and the
 * socket handshake picks up the token. Use the UI `register` in auth tests —
 * everything else only needs an account, and the form costs a second per test.
 */
export async function registerFast(
	page: Page,
	username: string,
	options: RegisterFastOptions = {},
): Promise<string> {
	const password = options.password ?? TEST_PASSWORD;
	const response = await page.request.post(`${BASE}/api/auth/register`, {
		data: { username, email: `${username}@example.test`, password },
	});
	if (!response.ok()) {
		throw new Error(
			`registering ${username} failed: ${response.status()} ${await response.text()}`,
		);
	}
	await page.goto(worldUrl(options.area));
	await waitForWorld(page);
	return username;
}

/** Registers an account then signs in, leaving the page on the farm map. */
export async function login(
	page: Page,
	username: string,
	password = TEST_PASSWORD,
): Promise<void> {
	await registerAccount(page, username, password);
	// Sign out from the menu, then sign back in from the login screen.
	await page.getByTestId("menu-logout").click();
	await page.getByTestId("menu-login").click();
	await page.waitForURL("**/login");
	await page.getByTestId("username").fill(username);
	await page.getByTestId("password").fill(password);
	await page.getByRole("button", { name: /Sign In/i }).click();
	await page.waitForURL(`${BASE}/`);
	await page.getByTestId("menu-user").waitFor();
	await enterFarm(page);
}
