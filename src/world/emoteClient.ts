import type { Channel } from "phoenix";
import { type EmoteId, getEmote } from "../../shared/emotes";
import { useGameStore } from "../store";

export interface ActiveEmote {
	name: string;
	id: EmoteId;
	at: number;
}

/** How long a received emote stays listed for the renderer and e2e hooks. */
export const EMOTE_VISIBLE_MS = 5_000;

let activeChannel: Channel | null = null;
let handlerRef: number | null = null;
const active = new Map<string, ActiveEmote>();
const expiryTimers = new Map<string, ReturnType<typeof setTimeout>>();
const listeners = new Set<(emotes: string[]) => void>();
let snapshot = "";

/** Validates a server `emote` push; malformed payloads are ignored. */
export function parseEmote(payload: unknown): ActiveEmote | null {
	if (!payload || typeof payload !== "object") return null;
	const { name, emote, at } = payload as {
		name?: unknown;
		emote?: unknown;
		at?: unknown;
	};
	if (typeof name !== "string" || name.length === 0) return null;
	if (typeof emote !== "string") return null;
	const def = getEmote(emote);
	if (!def) return null;
	return {
		name,
		id: def.id,
		at: typeof at === "number" ? at : Date.now(),
	};
}

/** Listens for emotes on the active surface (the joined hub or farm channel). */
export function attachEmotes(channel: Channel): void {
	detachEmotes();
	activeChannel = channel;
	handlerRef = channel.on("emote", (payload: unknown) => receiveEmote(payload));
}

export function detachEmotes(): void {
	if (activeChannel && handlerRef !== null)
		activeChannel.off("emote", handlerRef);
	activeChannel = null;
	handlerRef = null;
	clearActive();
	emit();
}

/** Sends the local player's emote; no-op outside a joined room. */
export function publishEmote(id: EmoteId): void {
	activeChannel?.push("emote", { emote: id });
}

export function getActiveEmotes(): ActiveEmote[] {
	return Array.from(active.values());
}

export function getActiveEmote(name: string): ActiveEmote | null {
	return active.get(name) ?? null;
}

/** Notifies when the emote list changes, not on every movement update. */
export function subscribeEmotes(
	listener: (emotes: string[]) => void,
): () => void {
	listeners.add(listener);
	listener(currentList());
	return () => {
		listeners.delete(listener);
	};
}

/** Test hook: drops every active emote and its expiry timer. */
export function resetEmotes(): void {
	clearActive();
	emit();
}

function receiveEmote(payload: unknown): void {
	const emote = parseEmote(payload);
	if (!emote) return;
	if (emote.name === useGameStore.getState().username) return;
	active.set(emote.name, emote);
	scheduleExpiry(emote);
	emit();
}

function scheduleExpiry(emote: ActiveEmote): void {
	const existing = expiryTimers.get(emote.name);
	if (existing) clearTimeout(existing);
	const timer = setTimeout(() => {
		const current = active.get(emote.name);
		if (current && current.at === emote.at) {
			active.delete(emote.name);
			expiryTimers.delete(emote.name);
			emit();
		}
	}, EMOTE_VISIBLE_MS);
	expiryTimers.set(emote.name, timer);
}

function clearActive(): void {
	for (const timer of expiryTimers.values()) clearTimeout(timer);
	expiryTimers.clear();
	active.clear();
}

function currentList(): string[] {
	return Array.from(active.values())
		.map((emote) => `${emote.name}:${emote.id}`)
		.sort();
}

function emit(): void {
	const list = currentList();
	const key = list.join(",");
	if (key === snapshot) return;
	snapshot = key;
	for (const listener of listeners) listener(list);
}
