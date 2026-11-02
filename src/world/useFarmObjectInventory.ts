import { useEffect } from "react";
import { useInventoryStore } from "../inventory/inventoryStore";
import type { ActiveFarm } from "../../shared/types";
import { useNotificationStore } from "../notifications/notificationStore";
import { livestockPens } from "./livestockData";
import { MOVABLE_PROP_ASSETS } from "./mapData";

/** Mirror server-owned farm objects into the local inventory display. */
export function useFarmObjectInventory(farm: ActiveFarm | null, isOwner: boolean): void {
	const setItemCount = useInventoryStore((s) => s.setItemCount);
	const inventoryHydrated = useInventoryStore((s) => s.inventoryHydrated);
	const fenceCount = farm?.fence_count;
	const gateCount = farm?.gate_count;
	const propInventory = farm?.prop_inventory;
	const ownedAnimals = farm?.animals;

	useEffect(() => {
		if (inventoryHydrated && fenceCount !== undefined && isOwner) setItemCount("fence", fenceCount);
	}, [fenceCount, isOwner, inventoryHydrated, setItemCount]);
	useEffect(() => {
		if (inventoryHydrated && gateCount !== undefined && isOwner) setItemCount("gate", gateCount);
	}, [gateCount, isOwner, inventoryHydrated, setItemCount]);
	useEffect(() => {
		if (!inventoryHydrated || !propInventory || !isOwner) return;
		for (const asset of MOVABLE_PROP_ASSETS)
			setItemCount(asset, propInventory[asset] ?? 0);
	}, [propInventory, isOwner, inventoryHydrated, setItemCount]);
	useEffect(() => {
		if (!inventoryHydrated || !ownedAnimals || !isOwner) return;
		for (const pen of livestockPens)
			setItemCount(pen.id, ownedAnimals[pen.id] ?? 0);
	}, [ownedAnimals, isOwner, inventoryHydrated, setItemCount]);
}

export function useFarmItemNotices(heldItem: string | null): void {
	const pushNotice = useNotificationStore((s) => s.push);
	useEffect(() => {
		if (heldItem === "fence")
			pushNotice("Hold left mouse to preview a fence; release on green to place.", "system");
		if (heldItem === "gate")
			pushNotice("Gate: click clear grass to place. Press E nearby to open or close.", "system");
		if (heldItem === "shovel")
			pushNotice("Shovel: click a fence or farm object to dig it up.", "system");
		if (heldItem && MOVABLE_PROP_ASSETS.some((asset) => asset === heldItem))
			pushNotice(`Hold left mouse to preview ${heldItem}; release on green to place.`, "system");
	}, [heldItem, pushNotice]);
}
