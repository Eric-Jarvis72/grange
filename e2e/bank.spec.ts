import { expect, test } from "@playwright/test";
import {
	expectArea,
	registerFast,
	uniqueName,
	useDoor,
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

	await walkUntilPrompt(page, ["w", "a"], "talk to bank teller", 15_000);
	await useDoor(page);
	const teller = page.getByRole("dialog", { name: "Talk to bank teller" });
	await expect(teller).toBeVisible();
	await teller.getByLabel("Amount").fill("20");
	await teller.getByRole("button", { name: "Deposit" }).click();
	await expect(teller).toContainText("Savings: $20");
	await teller.getByRole("button", { name: "Withdraw" }).click();
	await expect(teller).toContainText("Savings: $0");
	await page.keyboard.press("Escape");

	await walkUntilPrompt(page, ["d"], "talk to mayor", 15_000);
	await useDoor(page);
	const mayor = page.getByRole("dialog", { name: "Talk to mayor" });
	await expect(mayor).toContainText("Next parcel: $250");
	await expect(mayor.getByRole("button", { name: "Buy land" })).toBeDisabled();
});
