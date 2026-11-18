import { useEffect } from "react";
import { usePauseStore } from "../pause/pauseStore";
import { useInventoryStore } from "./inventoryStore";

/**
 * Global hotkeys for HUD/inventory/pause. Coexists with InputManager, which
 * only tracks movement keys. Ignores keystrokes inside form fields.
 */
export function useInventoryKeys(): void {
	const selectHotbar = useInventoryStore((s) => s.selectHotbar);
	const toggleInventory = useInventoryStore((s) => s.toggleInventory);
	const setInventoryOpen = useInventoryStore((s) => s.setInventoryOpen);
	const setBarnOpen = useInventoryStore((s) => s.setBarnOpen);
	const togglePause = usePauseStore((s) => s.togglePause);

	useEffect(() => {
		function isTypingTarget(target: EventTarget | null): boolean {
			if (!(target instanceof HTMLElement)) return false;
			const tag = target.tagName.toLowerCase();
			return (
				tag === "input" ||
				tag === "textarea" ||
				tag === "select" ||
				target.isContentEditable
			);
		}

		function onKeyDown(e: KeyboardEvent) {
			if (e.metaKey || e.ctrlKey || e.altKey) return;
			if (isTypingTarget(e.target)) return;

			if (e.code === "Escape") {
				e.preventDefault();
				if (useInventoryStore.getState().barnOpen) {
					setBarnOpen(false);
				} else if (useInventoryStore.getState().inventoryOpen) {
					setInventoryOpen(false);
				} else {
					togglePause();
				}
				return;
			}

			// Menus capture the rest: no tool selection while paused/opening UI.
			if (usePauseStore.getState().paused) return;
			// The barn window already shows the inventory; keep hotkeys out.
			if (useInventoryStore.getState().barnOpen) return;

			if (/^Digit[0-9]$/.test(e.code) || /^Numpad[0-9]$/.test(e.code)) {
				const digit = Number(
					e.code.replace("Digit", "").replace("Numpad", ""),
				);
				const index = digit === 0 ? 9 : digit - 1;
				selectHotbar(index);
				return;
			}

			if (e.code === "KeyI") {
				if (!e.repeat) toggleInventory();
			}
		}

		window.addEventListener("keydown", onKeyDown);
		return () => window.removeEventListener("keydown", onKeyDown);
	}, [
		selectHotbar,
		toggleInventory,
		setInventoryOpen,
		setBarnOpen,
		togglePause,
	]);
}
