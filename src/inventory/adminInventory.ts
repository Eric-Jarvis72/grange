import { GRID_SIZE, HOTBAR_SIZE, type LayoutSlot } from "./inventorySnapshot";
import { ITEMS, type ItemId } from "./items";

/**
 * Every item in the game at its max stack. Admin accounts receive this on
 * sign-in; items overflow into the grid so the persisted layout stays valid.
 */
export function buildAdminInventory(): {
	grid: LayoutSlot[];
	hotbar: LayoutSlot[];
} {
	const order = Object.keys(ITEMS) as ItemId[];
	const hotbar = Array.from({ length: HOTBAR_SIZE }, () => empty());
	const grid = Array.from({ length: GRID_SIZE }, () => empty());

	order.forEach((itemId, index) => {
		const slot = { itemId, count: ITEMS[itemId].maxStack };
		if (index < HOTBAR_SIZE) hotbar[index] = slot;
		else if (index - HOTBAR_SIZE < GRID_SIZE) {
			grid[index - HOTBAR_SIZE] = slot;
		}
	});

	return { grid, hotbar };
}

function empty(): LayoutSlot {
	return { itemId: null, count: 0 };
}
