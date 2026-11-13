import type { InventorySlot } from "./inventoryStore";
import { ITEMS, type ItemId } from "./items";

/** The slice of the inventory these queries read, in either area. */
export interface InventorySlots {
	grid: InventorySlot[];
	hotbar: InventorySlot[];
}

/** Total of `itemId` across both the grid and the hotbar. */
export function countItem(state: InventorySlots, itemId: ItemId): number {
	let total = 0;
	for (const slot of [...state.grid, ...state.hotbar]) {
		if (slot.itemId === itemId) total += slot.count;
	}
	return total;
}

/** How many more of an item the inventory can hold across all slots. */
export function freeSpaceFor(state: InventorySlots, itemId: ItemId): number {
	const max = ITEMS[itemId].maxStack;
	let space = 0;
	for (const slot of [...state.hotbar, ...state.grid]) {
		if (!slot.itemId) space += max;
		else if (slot.itemId === itemId) space += Math.max(0, max - slot.count);
	}
	return space;
}
