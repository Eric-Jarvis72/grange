import { CATALYST_IDS, catalystForItem } from "../../shared/crops";
import { useNotificationStore } from "../notifications/notificationStore";
import { useGameStore } from "../store";
import { emitUseCatalyst } from "../world/farmSocket";
import { catalystQueuedNotice } from "../world/catalystMessages";
import { useInventoryStore } from "./inventoryStore";
import type { ItemId } from "./items";

/** Applies the server's authoritative catalyst ledger to the local stacks. */
export function applyCatalystItems(items: Record<string, number>): void {
	const setItemCount = useInventoryStore.getState().setItemCount;
	for (const id of CATALYST_IDS) setItemCount(id, items[id] ?? 0);
}

/**
 * Uses a catalyst on the player's own farm. The server consumes it and queues
 * the transformation for the next dawn; the local count only changes when the
 * ack returns.
 */
export function activateCatalyst(itemId: ItemId): void {
	const push = useNotificationStore.getState().push;
	const catalyst = catalystForItem(itemId);
	if (!catalyst) return;

	const farm = useGameStore.getState().activeFarm;
	const username = useGameStore.getState().username;

	if (!farm) {
		push("Visit your farm to use a catalyst.", "system");
		return;
	}
	if (farm.owner !== username) {
		push("Only the farm owner can use catalysts.", "system");
		return;
	}

	emitUseCatalyst(farm.owner, itemId, (res) => {
		if (res.items) applyCatalystItems(res.items);
		if (!res.ok) {
			push(res.error ?? "Could not use catalyst.", "error");
			return;
		}
		push(catalystQueuedNotice(itemId), "system");
	});
}
