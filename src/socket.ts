import { type Channel, Socket } from "phoenix";
import type { WorldTime } from "../shared/mechanics";
import type {
	ActiveFarm,
	FarmSummary,
	NpcQuestStatus,
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
	npc?: NpcQuestStatus;
	balance?: number;
}

export interface FarmSettings {
	is_public: boolean;
	visitor_edit: boolean;
}

/** The lobby channel is shared by the whole app; farm visits live in farmSocket. */
let lobby: Channel | null = null;

export function reasonOf(payload: unknown): string | undefined {
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

	channel.on("worldTime", (payload: unknown) => {
		const { time } = payload as { time: WorldTime };
		useGameStore.getState().setWorldTime(time);
	});

	channel
		.join()
		.receive("ok", (payload: unknown) => {
			const { players, farms, items, time } = payload as {
				players: Player[];
				farms: FarmSummary[];
				items?: Record<string, number>;
				time?: WorldTime;
			};
			useGameStore.getState().setPlayers(players);
			useGameStore.getState().setFarms(farms);
			if (time) useGameStore.getState().setWorldTime(time);
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

export * from "./world/farmSocket";
