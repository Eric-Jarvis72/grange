import { TILE_SIZE } from "./mapData";

export interface SprinklerCoord {
	x: number;
	y: number;
}

/**
 * A sprinkler is anchored by the top-left tile of the 2x2 block it waters, so
 * the object itself sits on the corner those four tiles share.
 */
export const SPRINKLER_TILES: ReadonlyArray<{ dx: number; dy: number }> = [
	{ dx: 0, dy: 0 },
	{ dx: 1, dy: 0 },
	{ dx: 0, dy: 1 },
	{ dx: 1, dy: 1 },
];

export const sprinklerKey = (x: number, y: number) => `${x},${y}`;

/** The shared corner of the four covered tiles, in world pixels. */
export function sprinklerCorner(
	x: number,
	y: number,
): { x: number; y: number } {
	return { x: (x + 1) * TILE_SIZE, y: (y + 1) * TILE_SIZE };
}

/** Snaps a world position to the corner nearest it and returns its anchor tile. */
export function sprinklerAnchorAt(
	worldX: number,
	worldY: number,
): SprinklerCoord {
	return {
		x: Math.round(worldX / TILE_SIZE) - 1,
		y: Math.round(worldY / TILE_SIZE) - 1,
	};
}

export function sprinklerCovers(
	sx: number,
	sy: number,
	x: number,
	y: number,
): boolean {
	return x >= sx && x <= sx + 1 && y >= sy && y <= sy + 1;
}

export function sprinklerInBounds(x: number, y: number): boolean {
	return (
		Number.isInteger(x) &&
		Number.isInteger(y) &&
		x >= -2 &&
		x + 1 <= 19 &&
		y >= -4 &&
		y + 1 <= 9
	);
}
