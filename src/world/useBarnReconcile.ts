import { useEffect } from "react";
import { countItem, useInventoryStore } from "../inventory/inventoryStore";
import { reconcileBarn } from "./barnSync";

/**
 * Keeps the local inventory's produce in sync with the authoritative server
 * barn: harvesting adds items, selling removes them, and reloads stay
 * consistent. Idempotent, so remounts and page reloads can't double-count.
 */
export function useBarnReconcile(
	barn: Record<string, number> | null,
	isOwner: boolean,
): void {
	const addItem = useInventoryStore((s) => s.addItem);
	const removeItem = useInventoryStore((s) => s.removeItem);

	useEffect(() => {
		if (barn === null || !isOwner) return;
		reconcileBarn(barn, {
			addItem,
			removeItem,
			countItem: (itemId) => countItem(useInventoryStore.getState(), itemId),
		});
	}, [barn, isOwner, addItem, removeItem]);
}
