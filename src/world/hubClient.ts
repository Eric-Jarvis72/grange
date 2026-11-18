import type { Channel } from "phoenix";
import type { HubArea, HubPeer } from "../../shared/types";
import { socket } from "../socket";
import { PresencePeers } from "./presencePeers";

/** Positions are cosmetic; this keeps hub chatter light. */
const SEND_INTERVAL_MS = 100;
const MIN_SEND_DISTANCE = 1.5;

const peers = new PresencePeers();
let channel: Channel | null = null;
let area: HubArea | null = null;
let joined = false;
let lastSentAt = 0;
let lastSent: HubPeer | null = null;
let latest: { x: number; y: number } | null = null;

/** Latest snapshot of everyone else in the current hub area. */
export function getHubPeers(): HubPeer[] {
	return peers.current;
}

/**
 * Notifies when the *set* of names changes, not on every position update, so
 * React does not re-render at movement frequency.
 */
export function subscribeHubPeers(
	listener: (names: string[]) => void,
): () => void {
	return peers.subscribe(listener);
}

/** Joins one hub area, leaving the previous one. Safe to call repeatedly. */
export function joinHub(next: HubArea): void {
	if (area === next && channel) return;
	leaveHub();

	area = next;
	joined = false;
	lastSent = null;
	lastSentAt = 0;

	const joinedChannel = socket.channel(`hub:${next}`, {});
	channel = joinedChannel;

	joinedChannel
		.join()
		.receive("ok", () => {
			if (channel !== joinedChannel) return;
			joined = true;
			peers.attach(joinedChannel);
			if (latest) send(latest.x, latest.y, true);
		})
		.receive("error", () => {
			if (channel !== joinedChannel) return;
			leaveHub();
		});
}

/** Leaves the current hub area and forgets its players. */
export function leaveHub(): void {
	const leaving = channel;
	channel = null;
	area = null;
	joined = false;
	lastSent = null;
	latest = null;
	peers.detach();
	leaving?.leave();
}

/** Reports the local avatar position; throttled and dead-banded. */
export function publishHubPosition(x: number, y: number): void {
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
