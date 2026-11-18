import { create } from "zustand";
import type { NpcQuestStatus } from "../../shared/types";

interface NpcStore {
	/** Null until the farm join reply arrives, or when visiting someone else. */
	status: NpcQuestStatus | null;
	setStatus: (status: NpcQuestStatus | null) => void;
}

/** The farmhand's quest state, owned by the server and mirrored here. */
export const useNpcStore = create<NpcStore>((set) => ({
	status: null,
	setStatus: (status) => set({ status }),
}));

/**
 * Whether the farmhand should stand on the farm right now.
 *
 * He only exists for the owner, and only until the quest is finished. The
 * status is null for visitors and until the join reply lands, so the scene
 * simply hides him in those frames.
 */
export function shouldShowNpc(isOwner: boolean): boolean {
	if (!isOwner) return false;
	const status = useNpcStore.getState().status;
	return status !== null && status.stage !== "complete";
}
