import type { Channel } from "phoenix";
import type { HubPeer } from "../../shared/types";
import { PresencePeers } from "./presencePeers";

/** Positions are cosmetic; this keeps farm chatter light. */
const SEND_INTERVAL_MS = 100;
const MIN_SEND_DISTANCE = 1.5;

const peers = new PresencePeers();
let channel: Channel | null = null;
let joined = false;
let lastSentAt = 0;
let lastSent: HubPeer | null = null;
let latest: { x: number; y: number } | null = null;

/** Latest snapshot of everyone else on the current farm. */
export function getFarmPeers(): HubPeer[] {
	return peers.current;
}

/** Notifies when the set of names changes, not on every position update. */
export function subscribeFarmPeers(
	listener: (names: string[]) => void,
): () => void {
	return peers.subscribe(listener);
}

/** Starts presence for a farm channel after its join succeeds. */
export function attachFarmPresence(next: Channel): void {
	resetFarmPresence();
	channel = next;
	joined = true;
	peers.attach(next);
	if (latest) send(latest.x, latest.y, true);
}

/** Leaves the current farm's peer list and forgets its movement state. */
export function resetFarmPresence(): void {
	channel = null;
	joined = false;
	lastSent = null;
	lastSentAt = 0;
	latest = null;
	peers.detach();
}

/** Reports the local avatar position; throttled and dead-banded. */
export function publishFarmPosition(x: number, y: number): void {
	if (!Number.isFinite(x) || !Number.isFinite(y)) return;
	latest = { x, y };
	if (!joined || !channel) return;
	if (
		lastSent &&
		Math.hypot(x - lastSent.x, y - lastSent.y) < MIN_SEND_DISTANCE
	) {
		return;
	}
	send(x, y);
}

function send(x: number, y: number, force = false): void {
	if (!channel) return;
	const now = Date.now();
	if (!force && now - lastSentAt < SEND_INTERVAL_MS) return;
	lastSentAt = now;
	lastSent = { name: "", x, y };
	channel.push("move", { x, y });
}
