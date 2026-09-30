export const FARM_GRID_SIZE = 15;
export const FARM_GROW_MS = 10_000;
export const FARM_HARVEST_YIELD = 3;

export type FarmTileState = "tilled" | "planted" | "watered" | "ready";

export type FarmToolId = "hoe" | "seed" | "bucket" | "scythe";

export interface FarmTile {
	x: number;
	y: number;
	state: FarmTileState;
	cropId: "tomato";
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
