import { ITEMS, type ItemId } from "../inventory/items";

/**
 * Caps an incremental seed purchase at what the player can afford and what a
 * single inventory stack can hold. Never drops below 1 so the slider always has
 * a valid position, even when the player cannot currently afford a seed.
 */
export function seedPurchaseCap(
	balance: number,
	unitPrice: number,
	itemId: ItemId,
): number {
	const stackMax = ITEMS[itemId].maxStack;
	if (unitPrice <= 0) return stackMax;
	const affordable = Math.floor(balance / unitPrice);
	return Math.max(1, Math.min(stackMax, affordable));
}
