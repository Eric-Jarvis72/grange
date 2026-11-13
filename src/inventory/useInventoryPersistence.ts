import { useEffect } from "react";
import { fetchInventory } from "../auth";
import { useGameStore } from "../store";
import type { LayoutSlot, PersistedSlot } from "./inventorySnapshot";
import { serializeInventory } from "./inventorySnapshot";
import { useInventoryStore } from "./inventoryStore";

interface PendingSave {
	owner: string;
	slots: PersistedSlot[];
}

let pending: PendingSave | null = null;
let saving = false;

async function flush(): Promise<void> {
	if (saving) return;
	saving = true;

	try {
		while (pending) {
			const save = pending;
			pending = null;
			// Do not let a queued snapshot from a previous account land on the
			// next account that signs in.
			if (useGameStore.getState().username !== save.owner) continue;

			try {
				const res = await fetch("/api/inventory", {
					method: "PUT",
					credentials: "same-origin",
					keepalive: true,
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ slots: save.slots }),
				});
				if (!res.ok) await fetchInventory();
			} catch {
				// A dropped save is retried after the next inventory mutation.
			}
		}
	} finally {
		saving = false;
	}
}

/** Queues the newest layout; an in-flight save finishes before it is sent. */
export function queueInventorySave(
	owner: string,
	grid: LayoutSlot[],
	hotbar: LayoutSlot[],
): void {
	pending = { owner, slots: serializeInventory(grid, hotbar) };
	void flush();
}

/**
 * Persists the owner's layout after any local inventory change. Mount it after
 * the barn/fence/prop reconciliation effects so their corrections are included.
 */
export function useInventoryPersistence(
	enabled: boolean,
	owner: string | undefined,
): void {
	const grid = useInventoryStore((s) => s.grid);
	const hotbar = useInventoryStore((s) => s.hotbar);
	const hydrated = useInventoryStore((s) => s.inventoryHydrated);
	const synced = useInventoryStore((s) => s.inventorySynced);

	useEffect(() => {
		if (!enabled || !hydrated || !synced || !owner) return;
		queueInventorySave(owner, grid, hotbar);
	}, [enabled, hydrated, synced, owner, grid, hotbar]);
}
