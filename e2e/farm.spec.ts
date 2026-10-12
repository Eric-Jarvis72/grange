import { expect, test, type Page } from "@playwright/test";
import { register, resetServer, uniqueName } from "./helpers";

async function clickTile(page: Page, col: number, row: number) {
	const canvas = page.locator(".farm-map-canvas");
	const box = await canvas.boundingBox();
	expect(box).not.toBeNull();
	const x = box!.x + ((col + 0.5) / 18) * box!.width;
	const y = box!.y + ((row + 0.5) / 12) * box!.height;
	await page.mouse.click(x, y);
}

/** Samples a rendered tile's center pixel from a canvas screenshot. */
async function tilePixel(page: Page, col: number, row: number) {
	const buf = await page.locator(".farm-map-canvas").screenshot();
	const b64 = buf.toString("base64");
	return page.evaluate(
		async ({ b64, xf, yf }) => {
			const img = new Image();
			img.src = `data:image/png;base64,${b64}`;
			await img.decode();
			const canvas = document.createElement("canvas");
			canvas.width = img.width;
			canvas.height = img.height;
			const ctx = canvas.getContext("2d")!;
			ctx.drawImage(img, 0, 0);
			const d = ctx.getImageData(
				Math.floor(xf * img.width),
				Math.floor(yf * img.height),
				1,
				1,
			).data;
			return { r: d[0], g: d[1], b: d[2] };
		},
		{ b64, xf: (col + 0.5) / 18, yf: (row + 0.5) / 12 },
	);
}

test("farming loop: hoe, seed, bucket, grow, scythe", async ({ page }) => {
	await resetServer();
	await register(page, uniqueName("Sprout"));
	await expect(page).toHaveURL(/\/world$/);
	await expect(page.getByTestId("farm-tile")).toBeVisible();
	// The hotbar starts on the hoe.
	await expect(page.getByTestId("slot-hotbar-0")).toHaveClass(/inv-slot-selected/);

	// Hoe tile (9, 7)
	await clickTile(page, 9, 7);
	await expect(page.getByTestId("farm-tile")).toContainText("(9, 7): tilled");

	// Seeds (hotbar slot 2 maps to key "2")
	await page.keyboard.press("2");
	await expect(page.getByTestId("slot-hotbar-1")).toHaveClass(/inv-slot-selected/);
	await clickTile(page, 9, 7);
	await expect(page.getByTestId("farm-tile")).toContainText("(9, 7): planted");
	// Planting spends one tomato seed from the pouch (10 -> 9).
	await expect(page.getByTestId("slot-hotbar-1")).toHaveAttribute(
		"data-count",
		"9",
	);

	// Bucket
	await page.keyboard.press("3");
	await clickTile(page, 9, 7);
	await expect(page.getByTestId("farm-tile")).toContainText("(9, 7): watered");

	// Wait for 10s growth, then harvest
	await expect(page.getByTestId("farm-tile")).toContainText("(9, 7): ready", {
		timeout: 20_000,
	});
	await page.keyboard.press("4");
	await clickTile(page, 9, 7);
	// Harvested tomatoes land in the first free inventory slot: hotbar 5 (tomato)
	// receives the 3-tomato yield.
	await expect(page.getByTestId("slot-hotbar-4")).toHaveAttribute(
		"data-count",
		"3",
	);
	await expect(page.getByTestId("farm-tile")).toContainText("(9, 7): tilled");

	// Drag-paint tills two tiles at once
	await page.keyboard.press("1");
	const canvas = page.locator(".farm-map-canvas");
	const box = await canvas.boundingBox();
	const px = (c: number) => box!.x + ((c + 0.5) / 18) * box!.width;
	const py = (r: number) => box!.y + ((r + 0.5) / 12) * box!.height;
	await page.mouse.move(px(7), py(6));
	await page.mouse.down();
	await page.mouse.move(px(8), py(6), { steps: 5 });
	await page.mouse.up();
	await expect(page.getByTestId("farm-tile")).toContainText("(8, 6): tilled");
});

test("the hoe refuses fence tiles", async ({ page }) => {
	await resetServer();
	await register(page, uniqueName("Sprout"));
	await expect(page).toHaveURL(/\/world$/);
	await expect(page.getByTestId("notification-feed")).toBeVisible();

	await clickTile(page, 7, 5);
	await expect(page.getByTestId("notification-feed")).toContainText(
		"Something is in the way.",
	);
	await expect(page.getByTestId("farm-tile")).toContainText("(7, 5): grass");
});

test("the hoe refuses tiles behind buildings", async ({ page }) => {
	await resetServer();
	await register(page, uniqueName("Sprout"));
	await expect(page).toHaveURL(/\/world$/);

	await clickTile(page, 3, 2);
	await expect(page.getByTestId("notification-feed")).toContainText(
		"Something is in the way.",
	);
	await expect(page.getByTestId("farm-tile")).toContainText("(3, 2): grass");
});

test("tilling under flowers clears them", async ({ page }) => {
	await resetServer();
	await register(page, uniqueName("Sprout"));
	await expect(page).toHaveURL(/\/world$/);

	await clickTile(page, 11, 3);
	await expect(page.getByTestId("farm-tile")).toContainText("(11, 3): tilled");
});

test("hoeing and planting a tile round-trips through the server", async ({
	page,
}) => {
	await resetServer();
	await register(page, uniqueName("Farmer"));

	const canvas = page.locator("canvas[aria-label^='Farm map']");
	await expect(canvas).toBeVisible();

	const tiles = page.getByTestId("farm-map-tiles");
	await expect(tiles).toHaveText("0 tiles");

	// The player spawns on a farmable tile, so the selected tool acts immediately.
	await page.getByTestId("slot-hotbar-0").click();
	await page.keyboard.press("Space");
	await expect(tiles).toHaveText("1 tiles");

	await page.getByTestId("slot-hotbar-1").click();
	await page.keyboard.press("Space");
	await expect(tiles).toHaveText("1 tiles");
});

test("selecting a hotbar slot highlights it", async ({ page }) => {
	await resetServer();
	await register(page, uniqueName("Farmer"));

	await page.getByTestId("slot-hotbar-2").click();
	await expect(page.getByTestId("slot-hotbar-2")).toHaveClass(/inv-slot-selected/);
	await expect(page.getByTestId("slot-hotbar-0")).not.toHaveClass(
		/inv-slot-selected/,
	);
});

test("a visitor sees another farm read-only", async ({ page }) => {
	await resetServer();
	const owner = uniqueName("Owner");
	await register(page, owner);
	await page.keyboard.press("Escape");
	await page.getByTestId("logout").click();
	await page.waitForURL("**/");

	await register(page, uniqueName("Visitor"));
	await page.goto(`/farms/${encodeURIComponent(owner)}`);

	await expect(page.locator("canvas[aria-label^='Farm map']")).toBeVisible();
	await expect(page.getByTestId("notification-feed")).toContainText("Visiting");
});

test("tilled soil renders as brown dirt, not grass", async ({ page }) => {
	await resetServer();
	await register(page, uniqueName("Soil"));

	const grass = await tilePixel(page, 9, 7);
	// Grass is green-dominant.
	expect(grass.g).toBeGreaterThan(grass.r);

	await clickTile(page, 9, 7);
	await expect(page.getByTestId("farm-tile")).toContainText("(9, 7): tilled");

	// Tilled-dry soil is brown: red dominant over green and blue.
	const soil = await tilePixel(page, 9, 7);
	expect(soil.r).toBeGreaterThan(soil.g + 20);
	expect(soil.r).toBeGreaterThan(soil.b + 20);
});
