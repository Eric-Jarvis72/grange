import type { Vector } from "excalibur";
import type { ActiveFarm } from "../../shared/types";
import { emitFarmPropAction } from "../socket";
import type { FarmPropLayer } from "./farmPropLayer";
import { isMovablePropAsset } from "./mapData";

/** Returns true when the click was handled as a prop pickup/placement. */
export function handleFarmPropClick(item: string | null, pos: Vector,
	layer: FarmPropLayer, farm: ActiveFarm | null, owner: string,
	player: { x: number; y: number }, report: (message: string) => void): boolean {
	if (!farm) return false;
	if (item === "shovel") {
		const target = layer.pick(pos.x, pos.y);
		if (!target) return false;
		if (target.asset === "starter-train") {
			report("The train stays at the station.");
			return true;
		}
		emitFarmPropAction(owner, { kind: "dig", index: target.index }, (result) =>
			report(result.ok ? `${target.asset} moved to inventory.` :
				result.error ?? "Could not dig up object."));
		return true;
	}
	if (!item || !isMovablePropAsset(item)) return false;
	// Two-pixel placement preserves the original building coordinates (e.g. 210,260).
	const x = Math.round(pos.x / 2) * 2;
	const y = Math.round(pos.y / 2) * 2;
	if ((farm.prop_inventory[item] ?? 0) <= 0) {
		report(`No ${item} in inventory.`);
		return true;
	}
	const placement = nearestPropPlacement(x, y,
		(atX, atY) => layer.canPlace(item, atX, atY, player, farm));
	if (!placement) {
		report("Place this item without overlapping another object, crop, or the water.");
		return true;
	}
	emitFarmPropAction(owner, { kind: "place", asset: item, ...placement }, (result) =>
		report(result.ok ? `${item} placed${placement.x !== x || placement.y !== y ? " at the nearest clear spot" : ""}.` :
			result.error ?? "Could not place object."));
	return true;
}

/** Large bottom-anchored art can extend over nearby scenery even when the
 * click looks clear. Prefer the requested point, then a nearby legal anchor. */
export function nearestPropPlacement(x: number, y: number,
	canPlace: (x: number, y: number) => boolean): { x: number; y: number } | null {
	if (canPlace(x, y)) return { x, y };
	for (let distance = 16; distance <= 128; distance += 16) {
		const candidates: Array<{ x: number; y: number }> = [];
		for (let dx = -distance; dx <= distance; dx += 16) {
			for (let dy = -distance; dy <= distance; dy += 16) {
				if (Math.max(Math.abs(dx), Math.abs(dy)) !== distance) continue;
				candidates.push({ x: x + dx, y: y + dy });
			}
		}
		// On equal-distance options, a lower ground anchor keeps the prop in
		// front of the player rather than pulling it behind them.
		candidates.sort((a, b) =>
			Math.hypot(a.x - x, a.y - y) - Math.hypot(b.x - x, b.y - y) ||
			b.y - a.y);
		const valid = candidates.find((candidate) => canPlace(candidate.x, candidate.y));
		if (valid) return valid;
	}
	return null;
}
