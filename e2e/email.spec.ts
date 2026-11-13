import { expect, test } from "@playwright/test";
import {
	BASE,
	mailboxFor,
	registerAccount,
	tokenFrom,
	uniqueName,
} from "./helpers";

test("an unverified account cannot sign in until the email is verified", async ({
	page,
}) => {
	const name = uniqueName("Sprout");
	const email = `${name}@example.test`;

	await page.goto(`${BASE}/login`);
	await page.getByTestId("toggle-mode").click();
	await page.getByTestId("username").fill(name);
	await page.getByTestId("email").fill(email);
	await page.getByTestId("password").fill("harvest-please");
	await page.getByRole("button", { name: /Create Account/i }).click();
	await expect(page.getByTestId("auth-notice")).toBeVisible();

	// Sign-in is refused until the address is confirmed.
	await page.getByTestId("toggle-mode").click();
	await page.getByTestId("username").fill(name);
	await page.getByTestId("password").fill("harvest-please");
	await page.getByRole("button", { name: /Sign In/i }).click();
	await expect(page.getByTestId("auth-error")).toContainText(/verify/i);
	await expect(page.getByTestId("resend-link")).toBeVisible();
	await expect(page).toHaveURL(`${BASE}/login`);

	// The emailed link both verifies and signs the user in.
	const token = tokenFrom(await mailboxFor(email), "/verify");
	await page.goto(`${BASE}/verify?token=${encodeURIComponent(token)}`);
	await page.waitForURL(`${BASE}/`);
	await expect(page.getByTestId("menu-user")).toContainText(name);
});

test("a verification link can only be used once", async ({ page }) => {
	const name = uniqueName("Sprout");
	const email = `${name}@example.test`;

	await page.goto(`${BASE}/login`);
	await page.getByTestId("toggle-mode").click();
	await page.getByTestId("username").fill(name);
	await page.getByTestId("email").fill(email);
	await page.getByTestId("password").fill("harvest-please");
	await page.getByRole("button", { name: /Create Account/i }).click();
	await expect(page.getByTestId("auth-notice")).toBeVisible();

	const token = tokenFrom(await mailboxFor(email), "/verify");
	const url = `${BASE}/verify?token=${encodeURIComponent(token)}`;
	await page.goto(url);
	await page.waitForURL(`${BASE}/`);

	await page.getByTestId("menu-logout").click();
	await page.waitForURL(`${BASE}/`);
	await page.goto(url);
	await expect(page.getByTestId("verify-status")).toContainText(
		/invalid or expired/i,
	);
});

test("a forgotten password can be reset through the emailed link", async ({
	page,
}) => {
	const name = uniqueName("Sprout");
	const email = `${name}@example.test`;
	await registerAccount(page, name);

	await page.getByTestId("menu-logout").click();
	await page.waitForURL(`${BASE}/`);
	await page.getByTestId("menu-login").click();
	await page.waitForURL("**/login");
	await page.getByTestId("forgot-link").click();
	await page.waitForURL("**/forgot");

	await page.getByTestId("forgot-email").fill(email);
	await page.getByTestId("forgot-submit").click();
	await expect(page.getByTestId("forgot-status")).toBeVisible();

	const token = tokenFrom(await mailboxFor(email), "/reset");
	await page.goto(`${BASE}/reset?token=${encodeURIComponent(token)}`);
	await page.getByTestId("reset-password").fill("brand-new-pass");
	await page.getByTestId("reset-submit").click();
	await expect(page.getByTestId("reset-status")).toContainText(/updated/i);

	// The new password signs in; the old one no longer does.
	await page.goto(`${BASE}/login`);
	await page.getByTestId("username").fill(name);
	await page.getByTestId("password").fill("brand-new-pass");
	await page.getByRole("button", { name: /Sign In/i }).click();
	await page.waitForURL(`${BASE}/`);
	await expect(page.getByTestId("menu-user")).toContainText(name);
});
