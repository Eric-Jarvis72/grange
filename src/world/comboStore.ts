import { create } from "zustand";

interface ComboState {
	count: number;
	expiresAt: number;
	setCombo: (count: number, expiresAt: number) => void;
	clearCombo: () => void;
}

/**
 * Mirror of the scene's ComboTracker for the React HUD. The Excalibur scene
 * owns the authoritative tracker and pushes snapshots here each frame.
 */
export const useComboStore = create<ComboState>((set) => ({
	count: 0,
	expiresAt: 0,
	setCombo: (count, expiresAt) => set({ count, expiresAt }),
	clearCombo: () => set({ count: 0, expiresAt: 0 }),
}));
