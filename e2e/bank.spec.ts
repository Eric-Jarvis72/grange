import { expect, test } from "@playwright/test";
import {
	BASE,
	expectArea,
	hoverFarmTile,
	movePlayerNear,
	registerFast,
	uniqueName,
	useDoor,
	waitForWorld,
	walkToBank,
	walkUntilPrompt,
} from "./helpers";

test("the bank has teller and mayor desks, with saved money and land purchases", async ({
	page,
}) => {
	await registerFast(page, uniqueName("Banker"), { area: "marketplace" });

	await walkToBank(page);
	await useDoor(page);
	await expectArea(page, /^Bank map/, 10_000);

	await walkUntilPrompt(page, ["w", "a"], "talk to bank teller", 30_000);
	await useDoor(page);
	const teller = page.getByRole("dialog", { name: "Talk to bank teller" });
	await expect(teller).toBeVisible();
	await teller.getByLabel("Amount").fill("20");
	await teller.getByRole("button", { name: "Deposit" }).click();
	await expect(teller).toContainText("Savings: $20");
	await teller.getByRole("button", { name: "Withdraw" }).click();
	await expect(teller).toContainText("Savings: $0");
	await page.keyboard.press("Escape");

	await walkUntilPrompt(page, ["d"], "talk to mayor", 30_000);
	await useDoor(page);
	const mayor = page.getByRole("dialog", { name: "Talk to mayor" });
	await expect(mayor).toContainText("Next parcel: $250");
	await expect(mayor.getByRole("button", { name: "Buy land" })).toBeDisabled();
});

test("the final land parcel is walkable and farmable to the map border", async ({
	page,
}) => {
	test.setTimeout(180_000);
	await registerFast(page, uniqueName("Border"));

	// Before buying land, pressing into the owned edge points at the mayor.
	// Walk to the top border deterministically; a fixed key hold is too short
	// on a loaded CI runner.
	await movePlayerNear(page, 576, 32, 4, { reach: 0, timeout: 30_000 });
	await page.keyboard.down("w");
	try {
		await expect(page.getByTestId("notification-feed")).toContainText(
			"Talk with the Mayor to purchase more land.",
			{ timeout: 10_000 },
		);
	} finally {
		await page.keyboard.up("w");
	}

	await page.request.post(`${BASE}/api/economy/transaction`, {
		data: { delta: 10_000 },
	});
	for (let level = 1; level <= 5; level += 1) {
		const response = await page.request.post(`${BASE}/api/land/buy`, {
			data: {},
		});
		expect(response.ok()).toBeTruthy();
		expect((await response.json()) as { land_level: number }).toMatchObject({
			land_level: level,
		});
	}

	await page.reload();
	await waitForWorld(page);

	// The expanded north-west land accepts walking. Walk deterministically to
	// the top edge, then hold left until the player crosses x = 0. A single
	// fixed burst covers less ground on a loaded CI runner.
	await movePlayerNear(page, 576, -224, 8, {
		reach: 0,
		timeout: 45_000,
	});
	await page.keyboard.down("a");
	try {
		await expect
			.poll(
				async () => {
					await page.keyboard.down("a");
					return page.evaluate(() =>
						Number(
							document
								.querySelector(".farm-map-page")
								?.getAttribute("data-player-x"),
						),
					);
				},
				{ timeout: 60_000, intervals: [250] },
			)
			.toBeLessThan(0);
	} finally {
		await page.keyboard.up("a");
	}

	const position = await page.evaluate(() => {
		const el = document.querySelector(".farm-map-page");
		return {
			x: Number(el?.getAttribute("data-player-x")),
			y: Number(el?.getAttribute("data-player-y")),
		};
	});
	expect(position.x).toBeLessThan(0);
	expect(position.y).toBeLessThan(0);

	// The hoe works on the newly purchased edge tile under the player.
	const column = Math.floor(position.x / 64);
	const row = Math.floor(position.y / 64);
	await hoverFarmTile(page, column, row);
	await page.keyboard.press("1");
	await expect(async () => {
		await page.keyboard.press("Space");
		await expect(page.getByTestId("farm-tile")).toContainText(
			`(${column}, ${row}): tilled`,
			{ timeout: 800 },
		);
	}).toPass({ timeout: 20_000, intervals: [250] });
});
