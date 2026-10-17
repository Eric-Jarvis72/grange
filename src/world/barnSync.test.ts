import { describe, expect, it } from "vitest";
import type { ItemId } from "../inventory/items";
import { reconcileBarn } from "./barnSync";

function fakeInventory(initial: Partial<Record<ItemId, number>> = {}) {
	const counts = new Map<ItemId, number>(
		Object.entries(initial) as Array<[ItemId, number]>,
	);
	const calls: Array<["add" | "remove", ItemId, number]> = [];

	return {
		counts,
		calls,
		actions: {
			addItem: (itemId: ItemId, count: number) => {
				calls.push(["add", itemId, count]);
				counts.set(itemId, (counts.get(itemId) ?? 0) + count);
			},
			removeItem: (itemId: ItemId, count: number) => {
				calls.push(["remove", itemId, count]);
				counts.set(itemId, Math.max(0, (counts.get(itemId) ?? 0) - count));
			},
			countItem: (itemId: ItemId) => counts.get(itemId) ?? 0,
		},
	};
}

describe("reconcileBarn", () => {
	it("adds produce the barn holds but the inventory lacks", () => {
		const inv = fakeInventory();
		reconcileBarn({ tomato: 3 }, inv.actions);
		expect(inv.calls).toEqual([["add", "tomato", 3]]);
		expect(inv.counts.get("tomato")).toBe(3);
	});

	it("removes produce the inventory holds but the barn does not", () => {
		const inv = fakeInventory({ tomato: 3 });
		reconcileBarn({}, inv.actions);
		expect(inv.calls).toEqual([["remove", "tomato", 3]]);
		expect(inv.counts.get("tomato")).toBe(0);
	});

	it("reconciles each crop independently", () => {
		const inv = fakeInventory({ tomato: 3, wheat: 2 });
		reconcileBarn({ tomato: 1, wheat: 2, lettuce: 4 }, inv.actions);
		expect(inv.calls).toEqual([
			["add", "lettuce", 4],
			["remove", "tomato", 2],
		]);
	});

	it("is idempotent when the inventory already matches", () => {
		const inv = fakeInventory({ tomato: 2, wheat: 1 });
		reconcileBarn({ tomato: 2, wheat: 1 }, inv.actions);
		expect(inv.calls).toEqual([]);
	});

	it("ignores unknown barn keys", () => {
		const inv = fakeInventory();
		reconcileBarn({ not_a_crop: 5 }, inv.actions);
		expect(inv.calls).toEqual([]);
	});
});
