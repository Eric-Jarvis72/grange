import { create } from "zustand";
import type { EmoteId } from "../../shared/emotes";

type LocalEmoteHandler = (id: EmoteId) => void;

interface EmoteState {
	open: boolean;
	localHandler: LocalEmoteHandler | null;
	openWheel: () => void;
	closeWheel: () => void;
	toggleWheel: () => void;
	setLocalHandler: (handler: LocalEmoteHandler | null) => void;
	clearLocalHandler: (handler: LocalEmoteHandler) => void;
	choose: (id: EmoteId) => void;
}

/**
 * Emote-wheel UI state plus the active scene's local playback callback.
 *
 * Scenes register their handler on activate and clear it on deactivate, so the
 * wheel never needs a scene reference and the newest scene always wins.
 */
export const useEmoteStore = create<EmoteState>((set, get) => ({
	open: false,
	localHandler: null,
	openWheel: () => set({ open: true }),
	closeWheel: () => set({ open: false }),
	toggleWheel: () => set((state) => ({ open: !state.open })),
	setLocalHandler: (localHandler) => set({ localHandler }),
	clearLocalHandler: (handler) =>
		set((state) =>
			state.localHandler === handler ? { localHandler: null } : state,
		),
	choose: (id) => {
		get().localHandler?.(id);
		set({ open: false });
	},
}));

export function isEmoteWheelOpen(): boolean {
	return useEmoteStore.getState().open;
}

export function openEmoteWheel(): void {
	useEmoteStore.getState().openWheel();
}

export function closeEmoteWheel(): void {
	useEmoteStore.getState().closeWheel();
}

export function setLocalHandler(handler: LocalEmoteHandler | null): void {
	useEmoteStore.getState().setLocalHandler(handler);
}

export function clearLocalHandler(handler: LocalEmoteHandler): void {
	useEmoteStore.getState().clearLocalHandler(handler);
}
