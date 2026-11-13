import { expect, test } from "@playwright/test";
import { clickFarmTile, registerFast, uniqueName } from "./helpers";

/**
 * One reload proves both persistence paths: the authoritative seed ledger
 * (planting spent one seed) and the local inventory layout (a hotbar swap plus
 * two split stacks). Two separate boots + reloads used to re-test the same
 * hydration code.
 */
test("seed counts and inventory layout survive a page refresh", async ({
	page,
}) => {
	await registerFast(page, uniqueName("Persist"));
	await expect(page).toHaveURL(/\/world$/);

	// Hoe and plant one tomato seed, so the ledger drops from 10 to 9.
	await clickFarmTile(page, 9, 7);
	await expect(page.getByTestId("farm-map-tiles")).toHaveText("1 tiles");
	await page.keyboard.press("2");
	await clickFarmTile(page, 9, 7);
	await expect(page.getByTestId("slot-hotbar-1")).toHaveAttribute(
		"data-count",
		"9",
	);

	// Swap the watering can into slot 2 (index 1). The seed pouch moves to slot 3.
	await page
		.getByTestId("slot-hotbar-2")
		.dragTo(page.getByTestId("slot-hotbar-1"));
	await expect(page.getByTestId("slot-hotbar-1")).toHaveAttribute(
		"data-item",
		"watering-can",
	);

	// Right-click the seed pouch to split half into the first empty grid slot.
	await page.getByTestId("slot-hotbar-2").click({ button: "right" });
	await page.keyboard.press("i");
	await expect(page.getByTestId("slot-grid-0")).toHaveAttribute(
		"data-item",
		"seed-bag",
	);
	await page.keyboard.press("i");

	// Split the fence stack too, proving non-seed counts keep their layout.
	await page.getByTestId("slot-hotbar-5").click({ button: "right" });

	await expect
		.poll(async () => {
			const res = await page.request.get("/api/inventory");
			const data = (await res.json()) as {
				slots?: Array<{
					area: string;
					slot: number;
					item: string;
					count: number;
				}>;
			};
			return data.slots?.some(
				(slot) =>
					slot.area === "grid" &&
					slot.slot === 0 &&
					slot.item === "seed-bag" &&
					slot.count === 4,
			);
		})
		.toBe(true);

	await expect
		.poll(async () => {
			const res = await page.request.get("/api/inventory");
			const data = (await res.json()) as {
				slots?: Array<{
					area: string;
					slot: number;
					item: string;
					count: number;
				}>;
			};
			return data.slots?.some(
				(slot) =>
					slot.area === "grid" &&
					slot.slot === 1 &&
					slot.item === "fence" &&
					slot.count === 10,
			);
		})
		.toBe(true);

	// The server owns the seed count, so reloading must not restore the starter
	// 10, and the saved layout must come back with it.
	await page.reload();
	await expect(page.getByTestId("slot-hotbar-1")).toHaveAttribute(
		"data-item",
		"watering-can",
	);
	await expect(page.getByTestId("slot-hotbar-2")).toHaveAttribute(
		"data-item",
		"seed-bag",
	);
	await expect(page.getByTestId("slot-hotbar-2")).toHaveAttribute(
		"data-count",
		"5",
	);
	await expect(page.getByTestId("slot-hotbar-5")).toHaveAttribute(
		"data-count",
		"10",
	);
	await page.keyboard.press("i");
	await expect(page.getByTestId("slot-grid-0")).toHaveAttribute(
		"data-item",
		"seed-bag",
	);
	await expect(page.getByTestId("slot-grid-0")).toHaveAttribute(
		"data-count",
		"4",
	);
	await expect(page.getByTestId("slot-grid-1")).toHaveAttribute(
		"data-item",
		"fence",
	);
	await expect(page.getByTestId("slot-grid-1")).toHaveAttribute(
		"data-count",
		"10",
	);
});
