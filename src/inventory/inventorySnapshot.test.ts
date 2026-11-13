import { describe, expect, it } from "vitest";
import {
	type LayoutSlot,
	layoutFromSnapshot,
	serializeInventory,
} from "./inventorySnapshot";

describe("inventory snapshots", () => {
	it("serializes only occupied, positive slots", () => {
		const hotbar: LayoutSlot[] = Array.from({ length: 10 }, () => ({
			itemId: null,
			count: 0,
		}));
		hotbar[0] = { itemId: "hoe", count: 1 };
		const grid: LayoutSlot[] = Array.from({ length: 24 }, () => ({
			itemId: null,
			count: 0,
		}));
		grid[3] = { itemId: "seed-bag", count: 5 };

		expect(serializeInventory(grid, hotbar)).toEqual([
			{ area: "hotbar", slot: 0, item: "hoe", count: 1 },
			{ area: "grid", slot: 3, item: "seed-bag", count: 5 },
		]);
	});

	it("ignores malformed and out-of-range rows", () => {
		const { grid, hotbar, occupied } = layoutFromSnapshot([
			{ area: "hotbar", slot: 0, item: "hoe", count: 1 },
			{ area: "hotbar", slot: 99, item: "hoe", count: 1 },
			{ area: "grid", slot: 2, item: "not-an-item", count: 1 },
			{ area: "grid", slot: 3, item: "seed-bag", count: 0 },
		]);

		expect(occupied).toBe(1);
		expect(hotbar[0]).toMatchObject({ itemId: "hoe", count: 1 });
		expect(grid.every((slot) => slot.itemId === null)).toBe(true);
	});
});
