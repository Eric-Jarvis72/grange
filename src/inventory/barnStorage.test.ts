import { beforeEach, describe, expect, it } from "vitest";
import { BARN_SLOTS, barnEntries } from "./barnStorage";
import { freeSpaceFor, useInventoryStore } from "./inventoryStore";
import { ITEMS } from "./items";

beforeEach(() => {
	useInventoryStore.getState().resetInventory();
});

describe("barn storage model", () => {
	it("lists stored items sorted, dropping empty entries", () => {
		expect(barnEntries({ tomato: 3, "seed-bag": 0, crate: 1 })).toEqual([
			{ itemId: "crate", count: 1 },
			{ itemId: "tomato", count: 3 },
		]);
	});

	it("caps the list to the number of visible slots", () => {
		const storage = Object.fromEntries(
			Array.from({ length: BARN_SLOTS + 6 }, (_, i) => [`item-${i}`, 1]),
		);
		expect(barnEntries(storage)).toHaveLength(BARN_SLOTS);
	});

	it("reports free space across empty and partial stacks", () => {
		const state = useInventoryStore.getState();
		const slots = [...state.hotbar, ...state.grid];
		const seedStack = ITEMS["seed-bag"].maxStack;
		const heldSeeds = slots
			.filter((slot) => slot.itemId === "seed-bag")
			.reduce((sum, slot) => sum + slot.count, 0);
		const emptySlots = slots.filter((slot) => !slot.itemId).length;
		expect(freeSpaceFor(state, "seed-bag")).toBe(
			seedStack - heldSeeds + emptySlots * seedStack,
		);
	});

	it("tracks the barn window and clears it on reset", () => {
		useInventoryStore.getState().setBarnOpen(true);
		expect(useInventoryStore.getState().barnOpen).toBe(true);
		useInventoryStore.getState().resetInventory();
		expect(useInventoryStore.getState().barnOpen).toBe(false);
	});
});
