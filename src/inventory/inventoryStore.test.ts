import { beforeEach, describe, expect, it } from "vitest";
import {
	countItem,
	useInventoryStore,
} from "./inventoryStore";

beforeEach(() => {
	useInventoryStore.getState().resetInventory();
});

describe("inventory slots", () => {
	it("seeds a stub hotbar and physical Grangecoin stacks", () => {
		const { hotbar, grid } = useInventoryStore.getState();
		expect(hotbar).toHaveLength(10);
		expect(grid).toHaveLength(24);
		expect(hotbar[0]).toMatchObject({ itemId: "hoe", count: 1 });
		expect(grid[0]?.itemId).toBe("grangecoin");
		expect(countItem(useInventoryStore.getState(), "grangecoin")).toBe(165);
	});

	it("moves a stack into an empty slot", () => {
		const { moveStack } = useInventoryStore.getState();
		moveStack({ area: "hotbar", index: 0 }, { area: "grid", index: 10 });
		const { hotbar, grid } = useInventoryStore.getState();
		expect(hotbar[0]?.itemId).toBeNull();
		expect(grid[10]).toMatchObject({ itemId: "hoe", count: 1 });
	});

	it("merges partial stacks up to maxStack and keeps the remainder", () => {
		const { moveStack } = useInventoryStore.getState();
		moveStack({ area: "grid", index: 1 }, { area: "grid", index: 0 });
		const { grid } = useInventoryStore.getState();
		expect(grid[0]).toMatchObject({ itemId: "grangecoin", count: 165 });
		expect(grid[1]?.itemId).toBeNull();
	});

	it("swaps two different items", () => {
		const { moveStack } = useInventoryStore.getState();
		moveStack({ area: "hotbar", index: 0 }, { area: "hotbar", index: 4 });
		const { hotbar } = useInventoryStore.getState();
		expect(hotbar[0]).toMatchObject({ itemId: "tomato" });
		expect(hotbar[4]).toMatchObject({ itemId: "hoe" });
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
		splitHalf({ area: "grid", index: 0 }, { area: "grid", index: 10 });
		const { grid } = useInventoryStore.getState();
		expect(grid[10]).toMatchObject({ itemId: "grangecoin", count: 60 });
		expect(grid[0]).toMatchObject({ itemId: "grangecoin", count: 60 });
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
