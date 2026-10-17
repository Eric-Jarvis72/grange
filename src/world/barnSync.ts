import { CROPS, type CropId } from "../../shared/crops";
import { CROP_ITEMS, type ItemId } from "../inventory/items";

/** Inventory primitives the reconciler needs, injected for testability. */
export interface BarnReconcileActions {
	addItem: (itemId: ItemId, count: number) => void;
	removeItem: (itemId: ItemId, count: number) => void;
	countItem: (itemId: ItemId) => number;
}

/**
 * Makes the local inventory match the authoritative server barn exactly, per
 * crop. The barn is the single source of truth for produce, so reconciling (as
 * opposed to applying a delta from a remembered baseline) is idempotent: it
 * can't double-count across remounts or reloads, and it removes items again
 * when the barn shrinks after a sale.
 */
export function reconcileBarn(
	barn: Record<string, number>,
	actions: BarnReconcileActions,
): void {
	for (const cropId of Object.keys(CROPS) as CropId[]) {
		const itemId = CROP_ITEMS[cropId];
		if (!itemId) continue;
		const desired = barn[cropId] ?? 0;
		const actual = actions.countItem(itemId);
		if (desired > actual) actions.addItem(itemId, desired - actual);
		else if (desired < actual) actions.removeItem(itemId, actual - desired);
	}
}
