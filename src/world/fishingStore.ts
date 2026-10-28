import { create } from "zustand";
import { type RodId, STARTER_ROD } from "./fishingData";

interface FishingState {
	/** The rod currently in hand. Ownership lives in the inventory. */
	equippedRod: RodId;
	equipRod: (id: RodId) => void;
	resetFishing: () => void;
}

export const useFishingStore = create<FishingState>((set) => ({
	equippedRod: STARTER_ROD,

	equipRod: (id) => set({ equippedRod: id }),

	resetFishing: () => set({ equippedRod: STARTER_ROD }),
}));
