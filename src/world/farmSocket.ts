import type { Channel } from "phoenix";
import type {
	ActiveFarm,
	FarmAction,
	FarmGateAction,
	FarmPropAction,
	NpcQuestStatus,
	SleepVote,
	SleepVoteResultPayload,
} from "../../shared/types";
import {
	type Ack,
	type FarmAck,
	type FarmActionAck,
	type FarmSettings,
	reasonOf,
	socket,
} from "../socket";
import { useGameStore } from "../store";
import { attachFarmPresence, resetFarmPresence } from "./farmPresence";
import { useNpcStore } from "./npcStore";

let farmChannel: Channel | null = null;
let farmOwner: string | null = null;
// The world can boot into a hub: join the farm for its snapshot but publish
// presence only once the player is actually standing on the farm.
let farmPresencePaused = false;

function applyFarm(farm: ActiveFarm): void {
	useGameStore.getState().setActiveFarm(farm);
	if (farm.time) useGameStore.getState().setWorldTime(farm.time);
}

/**
 * Joins the farm channel for `owner` and (optionally) publishes presence.
 *
 * `presence` is false when the world boots straight into a hub: the SPA still
 * needs the farm snapshot for the HUD and `data-world-ready`, but the player
 * is not standing on the farm.
 */
export function emitVisitFarm(
	owner: string,
	cb?: (res: FarmAck) => void,
	presence = true,
): void {
	if (farmChannel && farmOwner === owner) {
		if (presence) {
			farmPresencePaused = false;
			attachFarmPresence(farmChannel);
			farmChannel.push("resumePresence", {});
		}
		cb?.({ ok: true });
		return;
	}

	farmPresencePaused = !presence;
	const channel = socket.channel(`farm:${owner}`, {});

	channel.on("farmUpdate", (payload: unknown) => {
		const { farm } = payload as { farm: ActiveFarm };
		applyFarm(farm);
	});

	channel.on("sleepVote", (payload: unknown) => {
		const { vote } = payload as { vote: SleepVote };
		useGameStore.getState().setSleepVote(vote);
	});

	channel.on("sleepResult", (payload: unknown) => {
		const result = payload as SleepVoteResultPayload;
		useGameStore.getState().setSleepVote(null);
		useGameStore.getState().setSleepResult(result);
	});

	// Dev/test builds can jump the farmhand quest; keep the mirror in step.
	channel.on("npcUpdate", (payload: unknown) => {
		const { npc } = payload as { npc?: NpcQuestStatus | null };
		useNpcStore.getState().setStatus(npc ?? null);
	});

	channel
		.join()
		.receive("ok", (payload: unknown) => {
			const { farm, npc } = payload as {
				farm: ActiveFarm;
				npc?: NpcQuestStatus | null;
			};
			const previous = farmChannel;
			farmChannel = channel;
			farmOwner = owner;
			applyFarm(farm);
			// Visitors get `npc: nil`, which hides the farmhand entirely.
			useNpcStore.getState().setStatus(npc ?? null);
			// Leaving the old channel drops this socket's subscription.
			if (previous && previous !== channel) previous.leave();
			if (farmPresencePaused) {
				resetFarmPresence();
				channel.push("pausePresence", {});
			} else {
				attachFarmPresence(channel);
			}
			cb?.({ ok: true, farm });
		})
		.receive("error", (payload: unknown) =>
			cb?.({ ok: false, error: reasonOf(payload) ?? "Farm not found" }),
		)
		.receive("timeout", () => cb?.({ ok: false, error: "Farm timed out" }));
}

export function emitLeaveFarm(cb?: (res: Ack) => void): void {
	leaveFarmChannel(true);
	cb?.({ ok: true });
}

/**
 * Pauses farm presence while travelling into a hub but keeps the farm channel
 * joined, so owner-only actions such as selling produce still work. The active
 * farm snapshot is kept; returning to the farm resumes presence.
 */
export function emitPauseFarmVisit(cb?: (res: Ack) => void): void {
	farmPresencePaused = true;
	resetFarmPresence();
	farmChannel?.push("pausePresence", {});
	cb?.({ ok: true });
}

function leaveFarmChannel(clearFarm: boolean): void {
	const channel = farmChannel;
	farmChannel = null;
	farmOwner = null;
	farmPresencePaused = false;
	resetFarmPresence();
	useNpcStore.getState().setStatus(null);
	useGameStore.getState().setSleepVote(null);
	useGameStore.getState().setSleepResult(null);
	channel?.leave();
	if (clearFarm) useGameStore.getState().setActiveFarm(null);
}

/** Owner-only: changes farm visibility and visitor editing. */
export function emitUpdateFarmSettings(
	owner: string,
	settings: FarmSettings,
	cb?: (res: FarmAck) => void,
): void {
	const channel = farmChannel;
	if (!channel || farmOwner !== owner) {
		cb?.({ ok: false, error: "not visiting farm" });
		return;
	}

	channel
		.push("updateSettings", settings)
		.receive("ok", (payload: unknown) => {
			const { farm } = payload as { farm?: ActiveFarm };
			if (farm) applyFarm(farm);
			cb?.({ ok: true, farm });
		})
		.receive("error", (payload: unknown) =>
			cb?.({ ok: false, error: reasonOf(payload) ?? "Could not update farm" }),
		)
		.receive("timeout", () => cb?.({ ok: false, error: "Timed out" }));
}

export function emitFarmAction(
	owner: string,
	action: FarmAction,
	cb?: (res: FarmActionAck) => void,
): void {
	const channel = farmChannel;
	if (!channel || farmOwner !== owner) {
		cb?.({ ok: false, error: "not visiting farm" });
		return;
	}

	channel
		.push("farmAction", { action })
		.receive("ok", (payload: unknown) => {
			const data = (payload ?? {}) as {
				seeds?: Record<string, number>;
				drops?: string[];
			};
			cb?.({ ok: true, ...data });
		})
		.receive("error", (payload: unknown) => {
			const seeds = (payload as { seeds?: Record<string, number> } | null)
				?.seeds;
			cb?.({
				ok: false,
				error: reasonOf(payload) ?? "Invalid action",
				seeds,
			});
		})
		.receive("timeout", () => cb?.({ ok: false, error: "Timed out" }));
}

/** Open/close a gate. Unlike farm actions, visitors may call this. */
export function emitGateAction(
	owner: string,
	action: FarmGateAction,
	cb?: (res: Ack) => void,
): void {
	const channel = farmChannel;
	if (!channel || farmOwner !== owner) {
		cb?.({ ok: false, error: "not visiting farm" });
		return;
	}
	channel
		.push("gateAction", { action })
		.receive("ok", () => cb?.({ ok: true }))
		.receive("error", (payload: unknown) =>
			cb?.({ ok: false, error: reasonOf(payload) ?? "Could not move gate" }),
		)
		.receive("timeout", () => cb?.({ ok: false, error: "Timed out" }));
}

export function emitFarmPropAction(
	owner: string,
	action: FarmPropAction,
	cb?: (res: Ack) => void,
): void {
	const channel = farmChannel;
	if (!channel || farmOwner !== owner) {
		cb?.({ ok: false, error: "not visiting farm" });
		return;
	}
	channel
		.push("farmPropAction", { action })
		.receive("ok", () => cb?.({ ok: true }))
		.receive("error", (payload: unknown) =>
			cb?.({ ok: false, error: reasonOf(payload) ?? "Invalid object action" }),
		)
		.receive("timeout", () => cb?.({ ok: false, error: "Timed out" }));
}

/** The joined farm channel when it belongs to `owner`, else null. */
export function farmChannelFor(owner: string): Channel | null {
	return farmChannel && farmOwner === owner ? farmChannel : null;
}

/** Asks the visited farm to sleep, advancing a night when approved. */
export function emitSleep(
	owner: string,
	cb?: (res: Ack & { result?: string }) => void,
): void {
	const channel = farmChannel;
	if (!channel || farmOwner !== owner) {
		cb?.({ ok: false, error: "not visiting farm" });
		return;
	}

	channel
		.push("sleep", {})
		.receive("ok", (payload: unknown) => {
			const { result } = payload as { result?: string };
			cb?.({ ok: true, result });
		})
		.receive("error", (payload: unknown) =>
			cb?.({ ok: false, error: reasonOf(payload) ?? "Could not sleep" }),
		)
		.receive("timeout", () => cb?.({ ok: false, error: "Timed out" }));
}

/** Casts this player's yes/no in an active farm sleep vote. */
export function emitSleepVote(
	owner: string,
	decision: "accept" | "decline",
	cb?: (res: Ack) => void,
): void {
	const channel = farmChannel;
	if (!channel || farmOwner !== owner) {
		cb?.({ ok: false, error: "not visiting farm" });
		return;
	}

	channel
		.push("sleepVote", { decision })
		.receive("ok", () => cb?.({ ok: true }))
		.receive("error", (payload: unknown) =>
			cb?.({ ok: false, error: reasonOf(payload) ?? "Vote failed" }),
		)
		.receive("timeout", () => cb?.({ ok: false, error: "Timed out" }));
}
