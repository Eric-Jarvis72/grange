import { type CropId, isCropId } from "./crops";

export const FARM_GRID_SIZE = 15;
export const FARM_GROW_MS = 10_000;
export const FARM_HARVEST_YIELD = 3;

export type FarmTileState = "tilled" | "planted" | "watered" | "ready";

export type FarmToolId = "hoe" | "seed" | "bucket" | "scythe";

export interface FarmTile {
	x: number;
	y: number;
	state: FarmTileState;
	cropId: CropId;
	/** Harvests left before a regrowing crop clears; defaults per crop. */
	harvestsRemaining?: number;
	/** Stage a regrowing crop resumes from after a harvest. */
	regrowFrom?: number;
	plantedAt?: number;
	wateredAt?: number;
	readyAt?: number;
}

export interface FarmInventory {
	tomatoSeed: number;
	tomato: number;
}

export interface FarmReadyTile {
	player: string;
	x: number;
	y: number;
}

/** The four orthogonal neighbour offsets (N, S, E, W). */
export const ORTHOGONAL_OFFSETS: ReadonlyArray<readonly [number, number]> = [
	[0, -1],
	[0, 1],
	[1, 0],
	[-1, 0],
];

export function orthogonalNeighbors(
	x: number,
	y: number,
): Array<{ x: number; y: number }> {
	return ORTHOGONAL_OFFSETS.map(([dx, dy]) => ({ x: x + dx, y: y + dy }));
}

export function isFarmInBounds(
	x: number,
	y: number,
	size: number = FARM_GRID_SIZE,
): boolean {
	return (
		Number.isInteger(x) &&
		Number.isInteger(y) &&
		x >= 0 &&
		y >= 0 &&
		x < size &&
		y < size
	);
}

export function farmTileKey(x: number, y: number): string {
	return `${x},${y}`;
}

/**
 * Encodes a crop plus its remaining-harvest count into the single `crop`
 * string the backend already stores, so regrowth survives without a schema
 * change. A count of 1 (the default) is omitted.
 */
export function encodeCrop(cropId: CropId, harvestsRemaining: number): string {
	return harvestsRemaining > 1 ? `${cropId}:${harvestsRemaining}` : cropId;
}

export function decodeCrop(crop: string | undefined): {
	cropId: CropId;
	harvestsRemaining: number;
} {
	const [rawId, rawCount] = (crop ?? "tomato").split(":");
	const cropId = isCropId(rawId) ? rawId : "tomato";
	const parsed = Number.parseInt(rawCount ?? "1", 10);
	const harvestsRemaining = Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
	return { cropId, harvestsRemaining };
}
