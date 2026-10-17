import { beforeEach, describe, expect, it } from "vitest";
import { countItem, useInventoryStore } from "./inventoryStore";

beforeEach(() => {
	useInventoryStore.getState().resetInventory();
});

describe("inventory slots", () => {
	it("starts with tools and a small seed pouch, no crops", () => {
		const { hotbar, grid } = useInventoryStore.getState();
		expect(hotbar).toHaveLength(10);
		expect(grid).toHaveLength(24);
		expect(hotbar[0]).toMatchObject({ itemId: "hoe", count: 1 });
		expect(hotbar[1]).toMatchObject({ itemId: "seed-bag", count: 10 });
		expect(hotbar[2]).toMatchObject({ itemId: "watering-can", count: 1 });
		expect(hotbar[3]).toMatchObject({ itemId: "scythe", count: 1 });
		expect(countItem(useInventoryStore.getState(), "seed-bag")).toBe(10);
		expect(countItem(useInventoryStore.getState(), "tomato")).toBe(0);
		expect(grid.every((slot) => slot.itemId === null)).toBe(true);
		expect(hotbar[5]).toMatchObject({ itemId: "fence", count: 20 });
		expect(hotbar[6]).toMatchObject({ itemId: "shovel", count: 1 });
	});

	it("syncs server fence stock without losing the selected fence slot", () => {
		const store = useInventoryStore.getState();
		store.selectHotbar(5);
		store.setItemCount("fence", 0);
		expect(useInventoryStore.getState().hotbar[5]).toMatchObject({ itemId: "fence", count: 0 });
		store.setItemCount("fence", 19);
		expect(countItem(useInventoryStore.getState(), "fence")).toBe(19);
	});

	it("keeps no currency item in slots", () => {
		const items = [
			...useInventoryStore.getState().grid,
			...useInventoryStore.getState().hotbar,
		].map((s) => s.itemId);
		expect(items).not.toContain("grangecoin");
	});

	it("moves a stack into an empty slot", () => {
		const { moveStack } = useInventoryStore.getState();
		moveStack({ area: "hotbar", index: 0 }, { area: "grid", index: 10 });
		const { hotbar, grid } = useInventoryStore.getState();
		expect(hotbar[0]?.itemId).toBeNull();
		expect(grid[10]).toMatchObject({ itemId: "hoe", count: 1 });
	});

	it("merges partial stacks of the same item", () => {
		const store = useInventoryStore.getState();
		store.splitHalf({ area: "hotbar", index: 1 }, { area: "grid", index: 0 });
		store.moveStack({ area: "hotbar", index: 1 }, { area: "grid", index: 0 });
		const { grid, hotbar } = useInventoryStore.getState();
		expect(grid[0]).toMatchObject({ itemId: "seed-bag", count: 10 });
		expect(hotbar[1]?.itemId).toBeNull();
	});

	it("swaps two different items", () => {
		const { moveStack } = useInventoryStore.getState();
		moveStack({ area: "hotbar", index: 0 }, { area: "hotbar", index: 2 });
		const { hotbar } = useInventoryStore.getState();
		expect(hotbar[0]).toMatchObject({ itemId: "watering-can" });
		expect(hotbar[2]).toMatchObject({ itemId: "hoe" });
	});

	it("never merges non-stackable tools", () => {
		const { addItem } = useInventoryStore.getState();
		addItem("hoe", 1);
		const { hotbar, grid } = useInventoryStore.getState();
		const hoes = [...hotbar, ...grid].filter((s) => s.itemId === "hoe");
		expect(hoes).toHaveLength(2);
		expect(hoes.every((s) => s.count === 1)).toBe(true);
	});

	it("splits half of a stack into an empty slot", () => {
		const { splitHalf } = useInventoryStore.getState();
		splitHalf({ area: "hotbar", index: 1 }, { area: "grid", index: 0 });
		const { grid, hotbar } = useInventoryStore.getState();
		expect(grid[0]).toMatchObject({ itemId: "seed-bag", count: 5 });
		expect(hotbar[1]).toMatchObject({ itemId: "seed-bag", count: 5 });
	});

	it("removes items across slots and empties drained ones", () => {
		const store = useInventoryStore.getState();
		expect(store.removeItem("seed-bag", 4)).toBe(4);
		expect(countItem(useInventoryStore.getState(), "seed-bag")).toBe(6);
		// Missing items remove nothing.
		expect(store.removeItem("tomato", 1)).toBe(0);

		expect(store.removeItem("seed-bag", 6)).toBe(6);
		expect(useInventoryStore.getState().hotbar[1]?.itemId).toBeNull();
	});

	it("selects hotbar slots and toggles the panel", () => {
		const store = useInventoryStore.getState();
		store.selectHotbar(9);
		expect(useInventoryStore.getState().selectedHotbar).toBe(9);
		store.selectHotbar(99);
		expect(useInventoryStore.getState().selectedHotbar).toBe(9);
		store.toggleInventory();
		expect(useInventoryStore.getState().inventoryOpen).toBe(true);
	});
});
