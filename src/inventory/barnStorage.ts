import type { ItemId } from "./items";

/**
 * The barn storage view model. The server stores a flat map of item id to
 * count, so the client renders it as one slot per stored item.
 */

/** Matches Grange.BarnStorage's caps so the client can pre-trim requests. */
export const BARN_SLOTS = 24;
export const BARN_ITEM_LIMIT = 999;

/** Stable empty map so a missing farm does not re-render on every read. */
export const EMPTY_STORAGE: Record<string, number> = {};

export interface BarnEntry {
	itemId: ItemId;
	count: number;
}

/** Storage entries in a stable order, capped to the visible slot count. */
export function barnEntries(storage: Record<string, number>): BarnEntry[] {
	return Object.entries(storage)
		.filter(([, count]) => count > 0)
		.sort(([a], [b]) => a.localeCompare(b))
		.slice(0, BARN_SLOTS)
		.map(([itemId, count]) => ({ itemId: itemId as ItemId, count }));
}
