import { FISH_ORDER, ROD_ORDER } from "../world/fishingData";
import type { ItemId } from "./items";

/** Inventory primitives the reconciler needs, injected for testability. */
export interface ItemReconcileActions {
  addItem: (itemId: ItemId, count: number) => void;
  countItem: (itemId: ItemId) => number;
}

/**
 * Tops up the local inventory with the rods and fish the server says the player
 * owns, so a reload or a fresh browser restores them.
 *
 * Additive on purpose: the free starter rod and any admin-granted stacks are
 * never stripped, and a late join reply can't shrink a stack the player just
 * earned. Selling already removes the item locally and on the server.
 */
export function reconcileServerItems(
  items: Record<string, number>,
  actions: ItemReconcileActions,
): void {
  for (const id of [...ROD_ORDER, ...FISH_ORDER]) {
    const desired = items[id] ?? 0;
    const actual = actions.countItem(id);
    if (desired > actual) actions.addItem(id, desired - actual);
  }
}
