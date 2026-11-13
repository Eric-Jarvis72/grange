import type { ActiveFarm, FarmSprinkler } from "../../shared/types";
import { emitFarmAction } from "../socket";
import { useGameStore } from "../store";
import { ownsFarmTile } from "./mapData";
import {
	sprinklerCorner,
	sprinklerInBounds,
	sprinklerKey,
} from "./sprinklerData";

/** Shared by the placement preview and the real action. */
export function sprinklerPlacementReason(
	farm: ActiveFarm,
	x: number,
	y: number,
): string | null {
	const level = farm.land_level ?? 0;
	if (!sprinklerInBounds(x, y)) return "Keep sprinklers on dry land.";
	if (!ownsFarmTile(x, y, level) || !ownsFarmTile(x + 1, y + 1, level))
		return "Buy this land from the mayor first.";
	if ((farm.sprinkler_count ?? 0) <= 0) return "No sprinklers in inventory.";
	if (
		(farm.sprinklers ?? []).some(
			(s) => sprinklerKey(s.x, s.y) === sprinklerKey(x, y),
		)
	)
		return "A sprinkler already sits here.";
	return null;
}

/** The closest sprinkler corner to a world position within reach, or null. */
export function sprinklerNear(
	farm: ActiveFarm,
	worldX: number,
	worldY: number,
	radius = 44,
): FarmSprinkler | null {
	let closest: { sprinkler: FarmSprinkler; distance: number } | null = null;
	for (const sprinkler of farm.sprinklers ?? []) {
		const corner = sprinklerCorner(sprinkler.x, sprinkler.y);
		const distance = Math.hypot(worldX - corner.x, worldY - corner.y);
		if (distance > radius) continue;
		if (!closest || distance < closest.distance)
			closest = { sprinkler, distance };
	}
	return closest?.sprinkler ?? null;
}

export function actOnSprinkler(
	owner: string,
	x: number,
	y: number,
	item: "sprinkler" | "shovel",
	report: (message: string) => void,
): void {
	const farm = useGameStore.getState().activeFarm;
	if (!farm) return;
	const here = (farm.sprinklers ?? []).some(
		(s) => sprinklerKey(s.x, s.y) === sprinklerKey(x, y),
	);
	if (item === "shovel" && !here) {
		report("No sprinkler to dig up here.");
		return;
	}
	if (item === "sprinkler") {
		const reason = sprinklerPlacementReason(farm, x, y);
		if (reason) {
			report(reason);
			return;
		}
	}

	const kind = item === "sprinkler" ? "place_sprinkler" : "remove_sprinkler";
	emitFarmAction(owner, { kind, x, y }, (result) => {
		if (!result.ok) {
			report(result.error ?? "Could not change sprinkler.");
			return;
		}
		report(
			item === "sprinkler"
				? "Sprinkler placed."
				: "Sprinkler returned to inventory.",
		);
	});
}
