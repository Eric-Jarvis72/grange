import { beforeEach, describe, expect, it } from "vitest";
import { countItem, useInventoryStore } from "./inventoryStore";
import { ITEMS } from "./items";

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
		expect(hotbar[4]).toMatchObject({ itemId: "gate", count: 2 });
		expect(hotbar[5]).toMatchObject({ itemId: "fence", count: 20 });
		expect(hotbar[6]).toMatchObject({ itemId: "shovel", count: 1 });
		expect(hotbar[7]).toMatchObject({ itemId: "bamboo", count: 1 });
		expect(useInventoryStore.getState().inventoryHydrated).toBe(false);
	});

	it("hydrates server seed counts without disturbing the layout", () => {
		const store = useInventoryStore.getState();
		store.selectHotbar(1);
		store.hydrateSeeds({ "seed-bag": 7, "wheat-seed": 3 });

		const hydrated = useInventoryStore.getState();
		expect(countItem(hydrated, "seed-bag")).toBe(7);
		expect(countItem(hydrated, "wheat-seed")).toBe(3);
		expect(hydrated.hotbar[0]).toMatchObject({ itemId: "hoe", count: 1 });
		expect(hydrated.selectedHotbar).toBe(1);
		expect(hydrated.inventoryHydrated).toBe(true);
	});

	it("empties a seed stack when the server reports zero", () => {
		const store = useInventoryStore.getState();
		store.hydrateSeeds({ "seed-bag": 0 });

		expect(countItem(useInventoryStore.getState(), "seed-bag")).toBe(0);
		expect(useInventoryStore.getState().hotbar[1]?.itemId).toBeNull();
	});

	it("syncs server fence and gate stock without losing their slots", () => {
		const store = useInventoryStore.getState();
		store.selectHotbar(5);
		store.setItemCount("fence", 0);
		expect(useInventoryStore.getState().hotbar[5]).toMatchObject({
			itemId: "fence",
			count: 0,
		});
		store.setItemCount("fence", 19);
		expect(countItem(useInventoryStore.getState(), "fence")).toBe(19);

		store.selectHotbar(4);
		store.setItemCount("gate", 0);
		expect(useInventoryStore.getState().hotbar[4]).toMatchObject({
			itemId: "gate",
			count: 0,
		});
		store.setItemCount("gate", 1);
		expect(countItem(useInventoryStore.getState(), "gate")).toBe(1);
	});

	it("keeps split fence stacks when the server total is unchanged", () => {
		const store = useInventoryStore.getState();
		store.splitHalf({ area: "hotbar", index: 5 }, { area: "grid", index: 0 });
		store.setItemCount("fence", 20);

		const { hotbar, grid } = useInventoryStore.getState();
		expect(hotbar[5]).toMatchObject({ itemId: "fence", count: 10 });
		expect(grid[0]).toMatchObject({ itemId: "fence", count: 10 });
	});

	it("fills every admin slot at max stack", () => {
		useInventoryStore.getState().grantAllItems();
		const { hotbar, grid } = useInventoryStore.getState();
		const capacity = hotbar.length + grid.length;
		const filled = [...hotbar, ...grid].filter((s) => s.itemId);
		const held = new Set(filled.map((s) => s.itemId));
		expect(filled).toHaveLength(capacity);
		expect(held).toEqual(new Set(Object.keys(ITEMS).slice(0, capacity)));
		for (const slot of filled) {
			if (slot.itemId) expect(slot.count).toBe(ITEMS[slot.itemId].maxStack);
		}
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

	it("hydrates a saved layout and keeps split seed stacks", () => {
		useInventoryStore.getState().hydrateInventory(
			[
				{ area: "hotbar", slot: 0, item: "hoe", count: 1 },
				{ area: "hotbar", slot: 1, item: "watering-can", count: 1 },
				{ area: "grid", slot: 0, item: "seed-bag", count: 5 },
				{ area: "grid", slot: 1, item: "seed-bag", count: 5 },
			],
			{ "seed-bag": 10 },
		);

		const hydrated = useInventoryStore.getState();
		expect(hydrated.hotbar[0]).toMatchObject({ itemId: "hoe", count: 1 });
		expect(hydrated.hotbar[1]).toMatchObject({
			itemId: "watering-can",
			count: 1,
		});
		expect(hydrated.grid[0]).toMatchObject({ itemId: "seed-bag", count: 5 });
		expect(hydrated.grid[1]).toMatchObject({ itemId: "seed-bag", count: 5 });
		expect(hydrated.inventoryHydrated).toBe(true);
		expect(hydrated.inventorySynced).toBe(true);
	});

	it("adjusts saved seed stacks to the authoritative total", () => {
		useInventoryStore.getState().hydrateInventory(
			[
				{ area: "grid", slot: 0, item: "seed-bag", count: 5 },
				{ area: "grid", slot: 1, item: "seed-bag", count: 5 },
			],
			{ "seed-bag": 7 },
		);

		const hydrated = useInventoryStore.getState();
		expect(countItem(hydrated, "seed-bag")).toBe(7);
		expect(hydrated.grid[0]).toMatchObject({ itemId: "seed-bag", count: 2 });
		expect(hydrated.grid[1]).toMatchObject({ itemId: "seed-bag", count: 5 });
	});

	it("keeps a seed split intact when the server total is unchanged", () => {
		const store = useInventoryStore.getState();
		store.splitHalf({ area: "hotbar", index: 1 }, { area: "grid", index: 0 });
		store.hydrateSeeds({ "seed-bag": 10 });

		const hydrated = useInventoryStore.getState();
		expect(hydrated.hotbar[1]).toMatchObject({ itemId: "seed-bag", count: 5 });
		expect(hydrated.grid[0]).toMatchObject({ itemId: "seed-bag", count: 5 });
	});

	it("holds caught fish as stackable items and sells them away", () => {
		const store = useInventoryStore.getState();
		expect(store.addItem("minnow", 2)).toBe(0);
		expect(store.addItem("minnow", 3)).toBe(0);
		expect(countItem(useInventoryStore.getState(), "minnow")).toBe(5);

		expect(store.removeItem("minnow", 4)).toBe(4);
		expect(countItem(useInventoryStore.getState(), "minnow")).toBe(1);
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
