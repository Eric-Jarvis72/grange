export const TILE_SIZE = 64;
export const MAP_COLUMNS = 18;
export const MAP_ROWS = 12;
export const MAP_WIDTH = MAP_COLUMNS * TILE_SIZE;
export const MAP_HEIGHT = MAP_ROWS * TILE_SIZE;

export type TerrainKey =
	| "grass"
	| "grass-tufts"
	| "grass-flowers"
	| "path-horizontal"
	| "path-vertical"
	| "path-cross"
	| "tilled-dry"
	| "tilled-watered"
	| "shore-north"
	| "water";

export type PropKey =
	| "farmhouse"
	| "barn"
	| "oak-tree"
	| "pine-tree"
	| "apple-tree"
	| "well"
	| "bench"
	| "sign"
	| "barrel"
	| "crate"
	| "daisies"
	| "marigolds"
	| "blue-flowers"
	| "starter-train";

export type MovablePropKey = Exclude<PropKey, "starter-train">;
export const MOVABLE_PROP_ASSETS: readonly MovablePropKey[] = [
	"farmhouse", "barn", "well", "bench", "sign", "barrel", "crate",
	"oak-tree", "pine-tree", "apple-tree", "daisies", "marigolds", "blue-flowers",
];
export const isMovablePropAsset = (asset: string): asset is MovablePropKey =>
	MOVABLE_PROP_ASSETS.includes(asset as MovablePropKey);

export interface MapProp {
	asset: PropKey;
	x: number;
	y: number;
	width: number;
}

const FIELD = { left: 7, right: 11, top: 6, bottom: 8 } as const;

/** The tilled plot the player can work, in map-tile coordinates. */
export const FIELD_GRID = {
	column: FIELD.left,
	row: FIELD.top,
	columns: FIELD.right - FIELD.left + 1,
	rows: FIELD.bottom - FIELD.top + 1,
} as const;

/** Field tile (0-based) to the world position of its center. */
export function fieldTileToWorld(
	column: number,
	row: number,
): { x: number; y: number } {
	return {
		x: (FIELD_GRID.column + column) * TILE_SIZE + TILE_SIZE / 2,
		y: (FIELD_GRID.row + row) * TILE_SIZE + TILE_SIZE / 2,
	};
}

/** World position to a field tile, or null when outside the plot. */
export function worldToFieldTile(
	x: number,
	y: number,
): { x: number; y: number } | null {
	const column = Math.floor(x / TILE_SIZE) - FIELD_GRID.column;
	const row = Math.floor(y / TILE_SIZE) - FIELD_GRID.row;

	if (
		column < 0 ||
		row < 0 ||
		column >= FIELD_GRID.columns ||
		row >= FIELD_GRID.rows
	) {
		return null;
	}

	return { x: column, y: row };
}

export const FARM_PLAYER_SPAWN = { x: 576, y: 620 } as const;
export const FARM_TRAIN_STOP = { x: 810, y: 600 } as const;
export const FARM_TRAIN_ENGINE_STOP = { x: 1070, y: 600 } as const;

/** The cart and engine share one continuous boarding area. */
export function isNearFarmTrain(x: number, y: number): boolean {
	const nearestX = Math.max(
		FARM_TRAIN_STOP.x,
		Math.min(x, FARM_TRAIN_ENGINE_STOP.x),
	);
	return Math.hypot(x - nearestX, y - FARM_TRAIN_STOP.y) <= 115;
}

/** Edit these rules to redraw the 64px terrain grid. */
export function terrainAt(column: number, row: number): TerrainKey {
	if (row === 11) return "water";
	if (row === 10) return "shore-north";
	if (column === 4 && row === 4) return "path-cross";
	if (row === 4) return "path-horizontal";
	if (column === 4 && row < 10) return "path-vertical";
	if ((column * 7 + row * 5) % 19 === 0) return "grass-flowers";
	if ((column * 3 + row * 11) % 8 === 0) return "grass-tufts";
	return "grass";
}

/** Only grass-family tiles can be hoed. Paths, water, and shore are ignored. */
export function isTillableTile(column: number, row: number): boolean {
	const terrain = terrainAt(column, row);
	return (
		terrain === "grass" ||
		terrain === "grass-tufts" ||
		terrain === "grass-flowers"
	);
}

/**
 * How each prop blocks tools. Fences are flat, so their full displayed rect
 * counts ("rect"). Buildings, trees, and furniture only block the ground
 * row their base stands on ("base") — canopies may overhang hoeable grass.
 * Flowers are decorative and stay tillable ("none"). Future props declare
 * their rule here when they are added.
 */
export type PropBlockingRule = "rect" | "base" | "none";

export const propBlocking: Record<PropKey, PropBlockingRule> = {
	farmhouse: "rect",
	barn: "rect",
	"oak-tree": "base",
	"pine-tree": "base",
	"apple-tree": "base",
	well: "rect",
	bench: "rect",
	sign: "rect",
	barrel: "rect",
	crate: "rect",
	daisies: "base",
	marigolds: "base",
	"blue-flowers": "base",
	"starter-train": "rect",
};

export const props: MapProp[] = [
	{ asset: "farmhouse", x: 210, y: 260, width: 250 },
	{ asset: "barn", x: 935, y: 270, width: 270 },
	{ asset: "well", x: 200, y: 400, width: 96 },
	{ asset: "bench", x: 305, y: 625, width: 96 },
	{ asset: "sign", x: 395, y: 400, width: 54 },
	{ asset: "barrel", x: 845, y: 332, width: 54 },
	{ asset: "crate", x: 895, y: 336, width: 58 },

	{ asset: "oak-tree", x: 72, y: 170, width: 132 },
	{ asset: "pine-tree", x: 500, y: 165, width: 122 },
	{ asset: "apple-tree", x: 670, y: 190, width: 128 },
	{ asset: "oak-tree", x: 1085, y: 185, width: 130 },
	{ asset: "pine-tree", x: 95, y: 610, width: 120 },
	{ asset: "starter-train", x: 960, y: 625, width: 340 },

	{ asset: "daisies", x: 330, y: 225, width: 52 },
	{ asset: "marigolds", x: 750, y: 225, width: 52 },
	{ asset: "blue-flowers", x: 1015, y: 410, width: 50 },
	{ asset: "daisies", x: 150, y: 475, width: 50 },
];
