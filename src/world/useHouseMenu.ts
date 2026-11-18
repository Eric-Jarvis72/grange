import { useCallback, useState, type RefObject } from "react";
import type { FarmMapScene } from "./FarmMapScene";

/** Pauses the farm scene while the owner's farmhouse settings are open. */
export function useHouseMenu(sceneRef: RefObject<FarmMapScene | null>) {
	const [houseOpen, setHouseOpen] = useState(false);

	const openHouseMenu = useCallback(() => {
		sceneRef.current?.setMenuPaused(true);
		setHouseOpen(true);
	}, [sceneRef]);

	const closeHouseMenu = useCallback(() => {
		sceneRef.current?.setMenuPaused(false);
		setHouseOpen(false);
	}, [sceneRef]);

	return { houseOpen, openHouseMenu, closeHouseMenu };
}
