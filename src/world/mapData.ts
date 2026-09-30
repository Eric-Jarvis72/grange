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
	| "fence-horizontal"
	| "fence-post"
	| "daisies"
	| "marigolds"
	| "blue-flowers";

export interface MapProp {
	asset: PropKey;
	x: number;
	y: number;
	width: number;
}

const FIELD = { left: 7, right: 11, top: 6, bottom: 8 } as const;

/** Edit these rules to redraw the 64px terrain grid. */
export function terrainAt(column: number, row: number): TerrainKey {
	if (row === 11) return "water";
	if (row === 10) return "shore-north";
	if (
		column >= FIELD.left &&
		column <= FIELD.right &&
		row >= FIELD.top &&
		row <= FIELD.bottom
	) {
		return "tilled-dry";
	}
	if (column === 4 && row === 4) return "path-cross";
	if (row === 4) return "path-horizontal";
	if (column === 4 && row < 10) return "path-vertical";
	if ((column * 7 + row * 5) % 19 === 0) return "grass-flowers";
	if ((column * 3 + row * 11) % 8 === 0) return "grass-tufts";
	return "grass";
}

export const props: MapProp[] = [
	{ asset: "farmhouse", x: 210, y: 260, width: 250 },
	{ asset: "barn", x: 935, y: 270, width: 270 },
	{ asset: "well", x: 200, y: 400, width: 96 },
	{ asset: "bench", x: 900, y: 610, width: 96 },
	{ asset: "sign", x: 395, y: 400, width: 54 },
	{ asset: "barrel", x: 845, y: 332, width: 54 },
	{ asset: "crate", x: 895, y: 336, width: 58 },

	{ asset: "oak-tree", x: 72, y: 170, width: 132 },
	{ asset: "pine-tree", x: 500, y: 165, width: 122 },
	{ asset: "apple-tree", x: 670, y: 190, width: 128 },
	{ asset: "oak-tree", x: 1085, y: 185, width: 130 },
	{ asset: "pine-tree", x: 95, y: 610, width: 120 },
	{ asset: "apple-tree", x: 1070, y: 625, width: 130 },

	{ asset: "daisies", x: 330, y: 225, width: 52 },
	{ asset: "marigolds", x: 750, y: 225, width: 52 },
	{ asset: "blue-flowers", x: 1015, y: 410, width: 50 },
	{ asset: "daisies", x: 150, y: 475, width: 50 },
];

for (const x of [465, 555, 645, 735]) {
	props.push({ asset: "fence-horizontal", x, y: 380, width: 86 });
}

// Leave a lower opening for future field interactions instead of using a decorative gate.
for (const x of [465, 555, 735]) {
	props.push({ asset: "fence-horizontal", x, y: 590, width: 86 });
}

for (const y of [440, 505, 570]) {
	props.push({ asset: "fence-post", x: 420, y, width: 42 });
	props.push({ asset: "fence-post", x: 780, y, width: 42 });
}
