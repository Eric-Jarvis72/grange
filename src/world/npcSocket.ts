import type { NpcQuestStatus } from "../../shared/types";
import { type FarmActionAck, farmChannelFor, reasonOf } from "../socket";
import { useNpcStore } from "./npcStore";

/** Owner-only: records that the farmhand's welcome has been shown. */
export function emitNpcIntroSeen(
	owner: string,
	cb?: (res: FarmActionAck) => void,
): void {
	const channel = farmChannelFor(owner);
	if (!channel) {
		cb?.({ ok: false, error: "not visiting farm" });
		return;
	}

	channel
		.push("npcIntroSeen", {})
		.receive("ok", (payload: unknown) => {
			const { npc } = (payload ?? {}) as { npc?: NpcQuestStatus };
			if (npc) useNpcStore.getState().setStatus(npc);
			cb?.({ ok: true, npc });
		})
		.receive("error", (payload: unknown) =>
			cb?.({ ok: false, error: reasonOf(payload) ?? "Could not talk to him" }),
		)
		.receive("timeout", () => cb?.({ ok: false, error: "Timed out" }));
}

/**
 * Owner-only: hands a ten-crop batch to the farmhand. He pays market price and
 * reports the credited balance, which replaces the local total.
 */
export function emitNpcSell(
	owner: string,
	item: string,
	cb?: (res: FarmActionAck) => void,
): void {
	const channel = farmChannelFor(owner);
	if (!channel) {
		cb?.({ ok: false, error: "not visiting farm" });
		return;
	}

	channel
		.push("npcSell", { item })
		.receive("ok", (payload: unknown) => {
			const { npc, balance } = (payload ?? {}) as {
				npc?: NpcQuestStatus;
				balance?: number;
			};
			if (npc) useNpcStore.getState().setStatus(npc);
			cb?.({ ok: true, npc, balance });
		})
		.receive("error", (payload: unknown) =>
			cb?.({ ok: false, error: reasonOf(payload) ?? "Could not sell" }),
		)
		.receive("timeout", () => cb?.({ ok: false, error: "Timed out" }));
}
