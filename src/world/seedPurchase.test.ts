import { describe, expect, it } from "vitest";
import { ITEMS } from "../inventory/items";
import { seedPurchaseCap } from "./seedPurchase";

describe("seed purchase cap", () => {
	it("caps at what the player can afford", () => {
		// 100 grangecoin at 8 each -> 12 seeds.
		expect(seedPurchaseCap(100, 8, "seed-bag")).toBe(12);
	});

	it("never offers more than one inventory stack", () => {
		const stackMax = ITEMS["seed-bag"].maxStack;
		expect(seedPurchaseCap(1_000_000, 1, "seed-bag")).toBe(stackMax);
	});

	it("keeps a usable slider position when the player cannot afford a seed", () => {
		expect(seedPurchaseCap(0, 8, "seed-bag")).toBe(1);
		expect(seedPurchaseCap(7, 8, "seed-bag")).toBe(1);
	});

	it("falls back to the stack cap for free items", () => {
		expect(seedPurchaseCap(10, 0, "seed-bag")).toBe(ITEMS["seed-bag"].maxStack);
	});
});
