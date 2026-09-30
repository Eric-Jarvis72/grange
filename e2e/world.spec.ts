import { expect, test } from "@playwright/test";

test("farm world loads without asset or page errors", async ({ page }) => {
	const pageErrors: string[] = [];
	const failedAssets: string[] = [];

	page.on("pageerror", (error) => {
		pageErrors.push(error.message);
	});

	page.on("response", (response) => {
		if (response.url().includes("/assets/farm/") && !response.ok()) {
			failedAssets.push(response.url());
		}
	});

	await page.goto("/world");

	const canvas = page.locator("canvas[aria-label^='Farm map']");
	await expect(canvas).toBeVisible();

	await page.waitForLoadState("networkidle");

	expect(pageErrors).toEqual([]);
	expect(failedAssets).toEqual([]);
});
