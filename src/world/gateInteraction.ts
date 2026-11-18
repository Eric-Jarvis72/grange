import type { FenceGate } from "../../shared/types";
import { emitGateAction } from "../socket";
import { TILE_SIZE } from "./mapData";

export interface NearbyGate {
	gate: FenceGate;
	prompt: string;
}

/** The closest gate within reach, or null when the player is elsewhere. */
export function nearbyGate(
	gates: FenceGate[],
	player: { x: number; y: number },
	radius = 90,
): NearbyGate | null {
	let closest: { gate: FenceGate; distance: number } | null = null;
	for (const gate of gates) {
		const x = gate.x * TILE_SIZE;
		const y = gate.y * TILE_SIZE;
		const distance = Math.hypot(player.x - x, player.y - y);
		if (distance > radius) continue;
		if (!closest || distance < closest.distance) closest = { gate, distance };
	}
	if (!closest) return null;
	return {
		gate: closest.gate,
		prompt: closest.gate.open
			? "Press E or Enter to close gate"
			: "Press E or Enter to open gate",
	};
}

export function toggleGate(owner: string, gate: FenceGate,
	report: (message: string) => void): void {
	emitGateAction(owner, { kind: "toggle_gate", x: gate.x, y: gate.y }, (result) => {
		if (!result.ok) report(result.error ?? "Could not move gate.");
	});
}
