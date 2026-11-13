import { useState } from "react";
import { emitBarnAction } from "../socket";
import { useGameStore } from "../store";
import { BARN_ITEM_LIMIT, EMPTY_STORAGE } from "./barnStorage";
import {
	freeSpaceFor,
	useInventoryStore,
	type SlotRef,
} from "./inventoryStore";
import { getItemDef, type ItemId } from "./items";

export interface BarnStorageControls {
	message: string | null;
	/** Stores the stack in one player inventory slot. */
	depositFrom: (ref: SlotRef) => void;
	/** Takes as much of a stored item as the inventory can hold. */
	withdraw: (item: ItemId) => void;
}

/**
 * Deposit/withdraw actions for the barn window. The server owns storage, so
 * each move is optimistic locally and reconciled against the `farmUpdate`
 * broadcast; a rejected move restores the player inventory.
 */
export function useBarnStorage(owner: string): BarnStorageControls {
	const storage = useGameStore((s) => s.activeFarm?.storage ?? EMPTY_STORAGE);
	const [message, setMessage] = useState<string | null>(null);

	function depositFrom(ref: SlotRef) {
		const state = useInventoryStore.getState();
		const slot = state[ref.area][ref.index];
		if (!slot?.itemId || slot.count <= 0) return;
		const item = slot.itemId;
		const room = BARN_ITEM_LIMIT - (storage[item] ?? 0);
		if (room <= 0) {
			setMessage("The barn is full.");
			return;
		}
		const amount = Math.min(slot.count, room);
		state.removeAt(ref, amount);
		emitBarnAction(owner, { kind: "deposit", item, count: amount }, (res) => {
			if (!res.ok) {
				useInventoryStore.getState().addItem(item, amount);
				setMessage(res.error ?? "Could not store the item.");
				return;
			}
			setMessage(`Stored ${amount} × ${getItemDef(item).name}.`);
		});
	}

	function withdraw(item: ItemId) {
		const stored = storage[item] ?? 0;
		if (stored <= 0) return;
		const room = freeSpaceFor(useInventoryStore.getState(), item);
		if (room <= 0) {
			setMessage("Your inventory is full.");
			return;
		}
		const amount = Math.min(stored, room);
		emitBarnAction(owner, { kind: "withdraw", item, count: amount }, (res) => {
			if (!res.ok) {
				setMessage(res.error ?? "Could not take the item.");
				return;
			}
			useInventoryStore.getState().addItem(item, amount);
			setMessage(`Took ${amount} × ${getItemDef(item).name}.`);
		});
	}

	return { message, depositFrom, withdraw };
}
