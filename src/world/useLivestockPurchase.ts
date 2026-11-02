import { useState } from "react";
import { useInventoryStore } from "../inventory/inventoryStore";
import { useGameStore } from "../store";
import { economy } from "./EconomyManager";
import { livestockPens, type AnimalId } from "./livestockData";

/** Keeps the HTTP purchase and inventory update out of the scene renderer. */
export function useLivestockPurchase(isOwner: boolean, username: string) {
	const [selected, select] = useState<AnimalId | null>(null);
	const [message, setMessage] = useState<string | null>(null);
	const [busy, setBusy] = useState(false);
	const setItemCount = useInventoryStore((state) => state.setItemCount);
	const pen = livestockPens.find((candidate) => candidate.id === selected);

	async function buy() {
		if (!pen || busy || !isOwner) return;
		setBusy(true);
		setMessage(null);
		try {
			const response = await fetch("/api/livestock/buy", {
				method: "POST",
				credentials: "same-origin",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ animal: pen.id }),
			});
			const result = await response.json() as {
				ok: boolean; balance?: number; owned?: number; error?: string;
			};
			if (!response.ok || !result.ok || result.balance === undefined || result.owned === undefined) {
				setMessage(result.error ?? "Purchase failed.");
				return;
			}
			economy.setBalance(result.balance);
			const current = useGameStore.getState().activeFarm;
			if (current && current.owner === username)
				useGameStore.getState().setActiveFarm({
					...current, animals: { ...current.animals, [pen.id]: result.owned },
				});
			setItemCount(pen.id, result.owned);
			setMessage(`${pen.name} purchased! It is now in your inventory.`);
		} catch {
			setMessage("Could not reach the livestock market server.");
		} finally {
			setBusy(false);
		}
	}

	return { pen, select, message, setMessage, busy, buy };
}
