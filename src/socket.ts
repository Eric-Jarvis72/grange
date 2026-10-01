import { io } from "socket.io-client";
import type {
	Game,
	GameEvent,
	GameSummary,
	Player,
	Submission,
} from "../shared/types";
import { useGameStore } from "./store";

/** Single shared socket connection for the whole SPA. */
export const socket = io();

export interface Ack {
	ok: boolean;
	error?: string;
}

export interface ResumeAck extends Ack {
	player?: Player;
}

export interface GameAck extends Ack {
	game?: Game;
	role?: "player" | "observer";
	removed?: boolean;
}

/**
 * Re-establishes game room membership after a reconnect. Identity is not sent -
 * the server reads it from the session cookie on the socket handshake.
 */
export function emitResume(cb?: (res: ResumeAck) => void): void {
	socket.emit("resume", cb);
}

export function requestGames(): void {
	socket.emit("games", ({ games }: { games: GameSummary[] }) => {
		useGameStore.getState().setGames(games);
	});
}

export function emitCreateGame(cb?: (res: GameAck) => void): void {
	socket.emit("createGame", cb);
}

export function emitJoinGame(
	gameId: string,
	cb?: (res: GameAck) => void,
): void {
	socket.emit("joinGame", { gameId }, cb);
}

export function emitLeaveGame(cb?: (res: GameAck) => void): void {
	socket.emit("leaveGame", cb);
}

export function emitDeleteGame(
	gameId: string,
	cb?: (res: GameAck) => void,
): void {
	socket.emit("deleteGame", { gameId }, cb);
}

export function emitSubmit(
	choice: Submission,
	cb?: (res: GameAck & { status?: "waiting" | "resolved" }) => void,
): void {
	socket.emit("submit", { choice }, cb);
}

/**
 * Forces a fresh socket so the io.use() handshake re-runs with the new session
 * cookie. The initial connection happens before sign-in, so without this the
 * server would never learn who the user is and every game event would be
 * rejected as "not logged in".
 */
export function rebindAuth(): void {
	socket.disconnect();
	socket.connect();
}

/** Registers global socket listeners. */
export function initSocket(): void {
	socket.on("players", ({ players }: { players: Player[] }) => {
		useGameStore.getState().setPlayers(players);
	});

	socket.on("games", ({ games }: { games: GameSummary[] }) => {
		useGameStore.getState().setGames(games);
	});

	socket.on(
		"gameUpdate",
		({ game, events }: { game: Game; events?: GameEvent[] }) => {
			useGameStore.getState().setActiveGame(game, events ?? []);
			const { username } = useGameStore.getState();
			useGameStore.getState().setMyGameId(game.id);
			if (username) {
				const isPlayer = game.players.some((p) => p.name === username);
				const isObserver = game.observers.includes(username);
				if (!isPlayer && !isObserver) {
					useGameStore.getState().setMyGameId(null);
				}
			}
		},
	);

	socket.on("gameDeleted", ({ gameId }: { gameId: string }) => {
		const st = useGameStore.getState();
		if (st.activeGame?.id === gameId) st.setActiveGame(null);
		if (st.myGameId === gameId) st.setMyGameId(null);
	});

	// rebindAuth() forces a fresh handshake after sign-in or sign-out, and
	// reconnection does the same on its own. Either way the server has just
	// re-resolved the session cookie, so ask it to restore game membership.
	socket.on("connect", () => {
		if (useGameStore.getState().user) emitResume();
	});
}
