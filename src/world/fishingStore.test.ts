import { beforeEach, describe, expect, it } from "vitest";
import { useFishingStore } from "./fishingStore";

const store = () => useFishingStore.getState();

describe("fishing store", () => {
	beforeEach(() => store().resetFishing());

	it("starts with the starter rod equipped", () => {
		expect(store().equippedRod).toBe("bamboo");
	});

	it("equips any rod it is handed", () => {
		store().equipRod("master");
		expect(store().equippedRod).toBe("master");
	});

	it("comes back to the starter rod after a reset", () => {
		store().equipRod("master");
		store().resetFishing();
		expect(store().equippedRod).toBe("bamboo");
	});
});
