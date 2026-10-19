import { expect, test } from "@playwright/test";
import {
	BASE,
	enterFarm,
	login,
	register,
	registerAccount,
	resetServer,
	uniqueName,
	waitForWorld,
} from "./helpers";

test("a new account registers, lands on the main menu, then enters the farm", async ({
	page,
}) => {
	await resetServer();
	const name = uniqueName("Sprout");
	await registerAccount(page, name);

	await expect(page).toHaveURL(`${BASE}/`);
	await expect(page.getByTestId("menu-user")).toContainText(name);

	await enterFarm(page);
	await expect(page).toHaveURL(/\/world$/);
	await page.keyboard.press("Escape");
	await expect(page.getByTestId("farm-map-user")).toContainText(name);
});

test("wrong credentials do not get past the login screen", async ({ page }) => {
	await resetServer();
	const name = uniqueName("Sprout");
	await register(page, name);

	await page.keyboard.press("Escape");
	await page.getByTestId("logout").click();
	await page.waitForURL(`${BASE}/`);
	await page.getByTestId("menu-login").click();
	await page.waitForURL("**/login");
	await page.getByTestId("username").fill(name);
	await page.getByTestId("password").fill("definitely-wrong");
	await page.getByRole("button", { name: /Sign In/i }).click();

	await expect(page.getByTestId("auth-error")).toBeVisible();
	await expect(page).toHaveURL(`${BASE}/login`);
	await expect(page.getByRole("button", { name: /Sign In/i })).toBeVisible();
});

test("an unknown username is rejected with the same generic message", async ({
	page,
}) => {
	await resetServer();
	await page.goto(`${BASE}/login`);
	await page.getByTestId("username").fill(uniqueName("Ghost"));
	await page.getByTestId("password").fill("whatever-123");
	await page.getByRole("button", { name: /Sign In/i }).click();

	await expect(page.getByTestId("auth-error")).toContainText(
		/invalid username or password/i,
	);
	await expect(page).toHaveURL(`${BASE}/login`);
});

test("a session survives a page reload", async ({ page }) => {
	await resetServer();
	const name = uniqueName("Sprout");
	await register(page, name);

	await page.reload();
	await expect(page).toHaveURL(/\/world$/);
	// The route sits behind the session guard, so wait for the farm to mount
	// and register its hotkeys before pressing Escape.
	await waitForWorld(page);
	await page.keyboard.press("Escape");
	await expect(page.getByTestId("farm-map-user")).toContainText(name);
});

test("protected routes redirect to the main menu without a session", async ({
	page,
}) => {
	await resetServer();
	await page.goto(`${BASE}/dashboard`);
	await expect(page).toHaveURL(`${BASE}/`);
	await expect(page.getByTestId("menu-login")).toBeVisible();
});

test("signing out clears the session so protected routes close again", async ({
	page,
}) => {
	await resetServer();
	await login(page, uniqueName("Sprout"));

	await page.keyboard.press("Escape");
	await page.getByTestId("logout").click();
	await page.waitForURL(`${BASE}/`);

	await page.goto(`${BASE}/dashboard`);
	await expect(page).toHaveURL(`${BASE}/`);
});

test("registration rejects a short password and a duplicate username", async ({
	page,
}) => {
	await resetServer();
	const name = uniqueName("Sprout");

	await page.goto(`${BASE}/login`);
	await page.getByTestId("toggle-mode").click();
	await page.getByTestId("username").fill(name);
	await page.getByTestId("email").fill(`${name}@example.test`);
	await page.getByTestId("password").fill("short");
	await page.getByRole("button", { name: /Create Account/i }).click();
	await expect(page.getByTestId("auth-error")).toContainText(/at least 8/i);
	await expect(page).toHaveURL(`${BASE}/login`);

	await page.getByTestId("password").fill("long-enough-pass");
	await page.getByRole("button", { name: /Create Account/i }).click();
	await page.waitForURL(`${BASE}/`);
	await page.getByTestId("menu-user").waitFor();

	await page.getByTestId("menu-logout").click();
	await page.getByTestId("menu-login").click();
	await page.waitForURL("**/login");
	await page.getByTestId("toggle-mode").click();
	await page.getByTestId("username").fill(name);
	await page.getByTestId("email").fill(`other-${name}@example.test`);
	await page.getByTestId("password").fill("long-enough-pass");
	await page.getByRole("button", { name: /Create Account/i }).click();
	await expect(page.getByTestId("auth-error")).toContainText(/username is taken/i);
	await expect(page).toHaveURL(`${BASE}/login`);
});
