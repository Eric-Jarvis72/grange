import { create } from "zustand";

export interface TravelMenuOption {
	id: string;
	label: string;
	detail?: string;
	onSelect: () => void;
}

interface TravelMenuState {
	open: boolean;
	title: string;
	options: TravelMenuOption[];
	onCancel: (() => void) | null;
	openMenu: (title: string, options: TravelMenuOption[], onCancel: () => void) => void;
	closeMenu: () => void;
	cancelMenu: () => void;
}

/** Shared state for the train destination menu opened by any world scene. */
export const useTravelMenuStore = create<TravelMenuState>((set, get) => ({
	open: false,
	title: "Where to?",
	options: [],
	onCancel: null,
	openMenu: (title, options, onCancel) =>
		set({ open: true, title, options, onCancel }),
	closeMenu: () => set({ open: false, options: [], onCancel: null }),
	cancelMenu: () => {
		const { onCancel } = get();
		set({ open: false, options: [], onCancel: null });
		onCancel?.();
	},
}));
