import { useEffect } from "react";
import { useGameStore } from "../store";
import { BarnWindow } from "../inventory/BarnWindow";
import { useInventoryStore } from "../inventory/inventoryStore";

/**
 * Renders the barn storage window from within the HUD. It reads the owner and
 * the open flag from the stores so `FarmMap` stays small, and only the owner
 * of the visited farm ever sees it.
 */
export function BarnOverlay() {
	const open = useInventoryStore((s) => s.barnOpen);
	const setOpen = useInventoryStore((s) => s.setBarnOpen);
	const username = useGameStore((s) => s.username);
	const owner = useGameStore((s) => s.activeFarm?.owner);

	// Leaving the world unmounts the overlay; make sure the flag resets.
	useEffect(() => () => setOpen(false), [setOpen]);

	if (!open || !owner || owner !== username) return null;
	return <BarnWindow owner={owner} onClose={() => setOpen(false)} />;
}
