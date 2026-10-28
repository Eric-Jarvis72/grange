import { describe, expect, it } from "vitest";
import {
	FISH,
	FISH_ORDER,
	isFishId,
	isRodId,
	ROD_ORDER,
	RODS,
} from "./fishingData";

describe("fishing data", () => {
	it("orders every fish and rod exactly once", () => {
		expect([...FISH_ORDER].sort()).toEqual(
			(Object.keys(FISH) as string[]).sort(),
		);
		expect([...ROD_ORDER].sort()).toEqual(
			(Object.keys(RODS) as string[]).sort(),
		);
	});

	it("gives every fish a positive value and non-empty details", () => {
		for (const fish of Object.values(FISH)) {
			expect(fish.value).toBeGreaterThan(0);
			expect(fish.name.length).toBeGreaterThan(0);
			expect(fish.emoji.length).toBeGreaterThan(0);
			expect(fish.blurb.length).toBeGreaterThan(0);
		}
	});

	it("keys each fish and rod to its own definition", () => {
		for (const id of FISH_ORDER) {
			expect(FISH[id].id).toBe(id);
		}
		for (const id of ROD_ORDER) {
			expect(RODS[id].id).toBe(id);
		}
	});

	it("makes each rod luckier and pricier than the last", () => {
		for (let i = 1; i < ROD_ORDER.length; i += 1) {
			const previous = RODS[ROD_ORDER[i - 1]];
			const current = RODS[ROD_ORDER[i]];
			expect(current.luck).toBeGreaterThan(previous.luck);
			expect(current.cost).toBeGreaterThan(previous.cost);
		}
	});

	it("starts on the luckless starter rod", () => {
		expect(RODS.bamboo.luck).toBe(0);
		expect(RODS.bamboo.cost).toBeLessThan(RODS.fiberglass.cost);
	});

	it("tops the rod price ladder at 10,000", () => {
		expect(RODS.master.cost).toBe(10_000);
		const costs = ROD_ORDER.map((id) => RODS[id].cost);
		for (let i = 1; i < costs.length; i += 1) {
			expect(costs[i]).toBeGreaterThan(costs[i - 1]);
		}
	});

	it("marks the two special fish rarer than the everyday catches", () => {
		const phishing = FISH.phishing;
		const loanShark = FISH["loan-sharks-brother"];
		expect(phishing.effect).toBe("steal");
		expect(loanShark.effect).toBe("clear-debt");
		expect(phishing.rarity).toBe("legendary");
		expect(loanShark.rarity).toBe("legendary");
		expect(phishing.baseWeight ?? 0).toBeLessThan(5);
		expect(loanShark.baseWeight ?? 0).toBeLessThan(phishing.baseWeight ?? 0);
	});

	it("recognises fish and rod ids", () => {
		expect(isFishId("minnow")).toBe(true);
		expect(isFishId("bamboo")).toBe(false);
		expect(isRodId("bamboo")).toBe(true);
		expect(isRodId("minnow")).toBe(false);
		expect(isFishId("nope")).toBe(false);
	});
});
