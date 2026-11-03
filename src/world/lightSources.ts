import type { ActiveFarm } from "../../shared/types";
import { TILE_SIZE } from "./mapData";
import type { WorldArea } from "./WalkingScene";

/** A world-space point that should glow through the night overlay. */
export interface LightSource {
	x: number;
	y: number;
	radius: number;
}

/** Static farm lights: farmhouse, barn, and the train-station windows. */
export const FARM_LIGHT_SOURCES: LightSource[] = [
	{ x: 210, y: 260, radius: 150 },
	{ x: 935, y: 270, radius: 135 },
	{ x: 960, y: 625, radius: 120 },
];

/** Static marketplace lights: shopfronts and the parked train. */
export const MARKETPLACE_LIGHT_SOURCES: LightSource[] = [
	{ x: 190, y: 300, radius: 135 },
	{ x: 575, y: 300, radius: 135 },
	{ x: 960, y: 300, radius: 135 },
	{ x: 1310, y: 545, radius: 120 },
	{ x: 935, y: 735, radius: 125 },
];

/** Ready crops glow softly, so a mature field stays readable at night. */
export function cropLightSources(farm: ActiveFarm | null): LightSource[] {
	if (!farm) return [];
	const sources: LightSource[] = [];
	for (const tile of farm.tiles) {
		if (tile.state !== "ready") continue;
		sources.push({
			x: tile.x * TILE_SIZE + TILE_SIZE / 2,
			y: tile.y * TILE_SIZE + TILE_SIZE / 2,
			radius: 58,
		});
	}
	return sources;
}

export function getLightSources(
	area: WorldArea,
	farm: ActiveFarm | null,
): LightSource[] {
	if (area === "Farm") {
		return [...FARM_LIGHT_SOURCES, ...cropLightSources(farm)];
	}
	if (area === "Marketplace") return MARKETPLACE_LIGHT_SOURCES;
	return [];
}
