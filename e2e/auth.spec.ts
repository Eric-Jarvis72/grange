import { expect, test } from "@playwright/test";
import { BASE, login, register, resetServer, uniqueName } from "./helpers";

test("a new account can register and lands on the farm map", async ({ page }) => {
	await resetServer();
	const name = uniqueName("Sprout");
	await register(page, name);
	await expect(page).toHaveURL(/\/world$/);
	await expect(page.getByTestId("farm-map-user")).toContainText(name);
});

test("wrong credentials do not get past the main menu", async ({ page }) => {
	await resetServer();
	const name = uniqueName("Sprout");
	await register(page, name);

	await page.getByTestId("logout").click();
	await page.waitForURL(`${BASE}/`);
	await page.getByTestId("username").fill(name);
	await page.getByTestId("password").fill("definitely-wrong");
	await page.getByRole("button", { name: /Sign In/i }).click();

	await expect(page.getByTestId("auth-error")).toBeVisible();
	await expect(page).toHaveURL(`${BASE}/`);
	await expect(page.getByRole("button", { name: /Sign In/i })).toBeVisible();
});

test("an unknown username is rejected with the same generic message", async ({
	page,
}) => {
	await resetServer();
	await page.goto(BASE);
	await page.getByTestId("username").fill(uniqueName("Ghost"));
	await page.getByTestId("password").fill("whatever-123");
	await page.getByRole("button", { name: /Sign In/i }).click();

	await expect(page.getByTestId("auth-error")).toContainText(
		/invalid username or password/i,
	);
	await expect(page).toHaveURL(`${BASE}/`);
});

test("a session survives a page reload", async ({ page }) => {
	await resetServer();
	const name = uniqueName("Sprout");
	await register(page, name);

	await page.reload();
	await expect(page).toHaveURL(/\/world$/);
	await expect(page.getByTestId("farm-map-user")).toContainText(name);
});

test("protected routes redirect to the main menu without a session", async ({
	page,
}) => {
	await resetServer();
	await page.goto(`${BASE}/dashboard`);
	await expect(page).toHaveURL(`${BASE}/`);
	await expect(page.getByRole("button", { name: /Sign In/i })).toBeVisible();
});

test("signing out clears the session so protected routes close again", async ({
	page,
}) => {
	await resetServer();
	await login(page, uniqueName("Sprout"));

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

	await page.goto(BASE);
	await page.getByTestId("toggle-mode").click();
	await page.getByTestId("username").fill(name);
	await page.getByTestId("email").fill(`${name}@example.test`);
	await page.getByTestId("password").fill("short");
	await page.getByRole("button", { name: /Create Account/i }).click();
	await expect(page.getByTestId("auth-error")).toContainText(/at least 8/i);
	await expect(page).toHaveURL(`${BASE}/`);

	await page.getByTestId("password").fill("long-enough-pass");
	await page.getByRole("button", { name: /Create Account/i }).click();
	await page.waitForURL("**/world");

	await page.getByTestId("logout").click();
	await page.waitForURL(`${BASE}/`);
	await page.getByTestId("toggle-mode").click();
	await page.getByTestId("username").fill(name);
	await page.getByTestId("email").fill(`other-${name}@example.test`);
	await page.getByTestId("password").fill("long-enough-pass");
	await page.getByRole("button", { name: /Create Account/i }).click();
	await expect(page.getByTestId("auth-error")).toContainText(/username is taken/i);
	await expect(page).toHaveURL(`${BASE}/`);
});
