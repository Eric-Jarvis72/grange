import { type Channel, Socket } from "phoenix";
import type {
	ActiveFarm,
	FarmAction,
	FarmGateAction,
	FarmPropAction,
	FarmSummary,
	Player,
} from "../shared/types";
import { countItem, useInventoryStore } from "./inventory/inventoryStore";
import { reconcileServerItems } from "./inventory/itemSync";
import type { ItemId } from "./inventory/items";
import { useGameStore } from "./store";

/** Session token used to authenticate the socket handshake. */
let authToken: string | null = null;

export function setAuthToken(token: string | null): void {
	authToken = token;
}

/** Single shared connection for the whole SPA. */
export const socket = new Socket("/socket", {
	params: () => ({ token: authToken }),
});

export interface Ack {
	ok: boolean;
	error?: string;
}

export interface FarmAck extends Ack {
	farm?: ActiveFarm;
}

/** Reply to a successful farm action, carrying authoritative seed state. */
export interface FarmActionAck extends Ack {
	seeds?: Record<string, number>;
	drops?: string[];
}

/** The lobby channel is shared by the whole app; the farm channel tracks visits. */
let lobby: Channel | null = null;
let farmChannel: Channel | null = null;
let farmOwner: string | null = null;

function reasonOf(payload: unknown): string | undefined {
	if (payload && typeof payload === "object") {
		if ("error" in payload)
			return String((payload as { error?: unknown }).error);
		if ("reason" in payload)
			return String((payload as { reason?: unknown }).reason);
	}
	return undefined;
}

/**
 * Mirrors the server's durable rods and fish into the local inventory. The
 * server is the source of truth for those items, so they come back after a
 * reload or on a new browser.
 */
function applyServerItems(items: Record<string, number> | undefined): void {
	if (!items) return;
	reconcileServerItems(items, {
		addItem: (itemId, count) =>
			useInventoryStore.getState().addItem(itemId, count),
		countItem: (itemId) => countItem(useInventoryStore.getState(), itemId),
	});
}

function joinLobby(): Channel {
	if (lobby) return lobby;

	const channel = socket.channel("lobby", {});

	channel.on("players", (payload: unknown) => {
		const { players } = payload as { players: Player[] };
		useGameStore.getState().setPlayers(players);
	});

	channel.on("farms", (payload: unknown) => {
		const { farms } = payload as { farms: FarmSummary[] };
		useGameStore.getState().setFarms(farms);
	});

	channel
		.join()
		.receive("ok", (payload: unknown) => {
			const { players, farms, items } = payload as {
				players: Player[];
				farms: FarmSummary[];
				items?: Record<string, number>;
			};
			useGameStore.getState().setPlayers(players);
			useGameStore.getState().setFarms(farms);
			applyServerItems(items);
		})
		.receive("error", () => {
			lobby = null;
		});

	lobby = channel;
	return channel;
}

/** Persists a rod or fish the player gained, so it survives a reload. */
export function emitAddItem(item: ItemId, count: number): void {
	joinLobby().push("addItem", { item, count });
}

/** Persists rods or fish the player lost (e.g. a market sale). */
export function emitRemoveItem(item: ItemId, count: number): void {
	joinLobby().push("removeItem", { item, count });
}

export function requestFarms(): void {
	joinLobby()
		.push("farms", {})
		.receive("ok", (payload: unknown) => {
			const { farms } = payload as { farms: FarmSummary[] };
			useGameStore.getState().setFarms(farms);
		});
}

export function emitVisitFarm(
	owner: string,
	cb?: (res: FarmAck) => void,
): void {
	if (farmChannel && farmOwner === owner) {
		cb?.({ ok: true });
		return;
	}

	const channel = socket.channel(`farm:${owner}`, {});

	channel.on("farmUpdate", (payload: unknown) => {
		const { farm } = payload as { farm: ActiveFarm };
		useGameStore.getState().setActiveFarm(farm);
	});

	channel
		.join()
		.receive("ok", (payload: unknown) => {
			const { farm } = payload as { farm: ActiveFarm };
			const previous = farmChannel;
			farmChannel = channel;
			farmOwner = owner;
			useGameStore.getState().setActiveFarm(farm);
			// Leaving the old channel drops this socket's subscription.
			if (previous && previous !== channel) previous.leave();
			cb?.({ ok: true, farm });
		})
		.receive("error", (payload: unknown) =>
			cb?.({ ok: false, error: reasonOf(payload) ?? "Farm not found" }),
		)
		.receive("timeout", () => cb?.({ ok: false, error: "Farm timed out" }));
}

export function emitLeaveFarm(cb?: (res: Ack) => void): void {
	const channel = farmChannel;
	if (!channel) {
		cb?.({ ok: true });
		return;
	}

	channel.leave();
	farmChannel = null;
	farmOwner = null;
	useGameStore.getState().setActiveFarm(null);
	cb?.({ ok: true });
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

/** Sells a produce item from the visited farm's barn back to the market. */
export function emitSellProduce(
	owner: string,
	item: string,
	count: number,
	cb?: (res: Ack) => void,
): void {
	const channel = farmChannel;
	if (!channel || farmOwner !== owner) {
		cb?.({ ok: false, error: "not visiting farm" });
		return;
	}

	channel
		.push("sellProduce", { item, count })
		.receive("ok", () => cb?.({ ok: true }))
		.receive("error", (payload: unknown) =>
			cb?.({ ok: false, error: reasonOf(payload) ?? "Could not sell" }),
		)
		.receive("timeout", () => cb?.({ ok: false, error: "Timed out" }));
}

/** Registers global handlers and opens the lobby channel. */
export function initSocket(): void {
	socket.connect();
	socket.onOpen(() => {
		joinLobby();
	});
	joinLobby();
}

/**
 * Forces a fresh socket so the handshake re-runs with the new session cookie.
 * The initial connection happens before sign-in, so without this the server
 * would never learn who the user is.
 */
export function rebindAuth(): void {
	socket.disconnect();
	socket.connect();
	joinLobby();
}
