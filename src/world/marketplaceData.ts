import type { TerrainKey } from "./mapData";
import type { RenderedProp } from "./sceneRendering";

export type MarketplacePropKey =
	| "seed-shop"
	| "produce-stall"
	| "game-hall"
	| "livestock-pavilion"
	| "village-bank"
	| "hardware-store"
	| "seed-display"
	| "produce-cart"
	| "notice-board"
	| "signpost"
	| "starter-train"
	| "oak-tree"
	| "pine-tree"
	| "daisies"
	| "marigolds"
	| "barrel"
	| "crate";

export const MARKETPLACE_PLAYER_SPAWN = { x: 935, y: 620 } as const;
export const MARKETPLACE_TRAIN_STOP = { x: 935, y: 655 } as const;
export const MARKETPLACE_CASINO_ENTRANCE = { x: 960, y: 340 } as const;
export const MARKETPLACE_SEED_MARKET_ENTRANCE = { x: 190, y: 350 } as const;
export const MARKETPLACE_PRODUCE_MARKET_ENTRANCE = { x: 575, y: 350 } as const;
export const MARKETPLACE_LIVESTOCK_ENTRANCE = { x: 650, y: 575 } as const;
export const MARKETPLACE_BANK_ENTRANCE = { x: 1310, y: 570 } as const;
export const MARKETPLACE_HARDWARE_ENTRANCE = { x: 1230, y: 355 } as const;
/**
 * Wide enough to leave open plots beyond the current stalls for future
 * buildings. The world extends left and above the original 24x12 map too, so
 * the camera can scroll into new construction space on every exposed side.
 */
export const MARKETPLACE_MIN_COLUMN = -8;
export const MARKETPLACE_MAX_COLUMN = 31;
export const MARKETPLACE_COLUMNS =
	MARKETPLACE_MAX_COLUMN - MARKETPLACE_MIN_COLUMN + 1;
export const MARKETPLACE_MIN_ROW = -8;
export const MARKETPLACE_MAX_ROW = 11;
export const MARKETPLACE_ROWS =
	MARKETPLACE_MAX_ROW - MARKETPLACE_MIN_ROW + 1;
/** Right edge and top edge of the walkable marketplace, in world pixels. */
export const MARKETPLACE_WIDTH = (MARKETPLACE_MAX_COLUMN + 1) * 64;
export const MARKETPLACE_HEIGHT = (MARKETPLACE_MAX_ROW + 1) * 64;
export const MARKETPLACE_MIN_X = MARKETPLACE_MIN_COLUMN * 64;
export const MARKETPLACE_MIN_Y = MARKETPLACE_MIN_ROW * 64;

export function marketplaceTerrainAt(column: number, row: number): TerrainKey {
	if (
		(row === 5 || row === 9) &&
		(column === 4 || column === 9 || column === 14 || column === 20)
	) {
		return "path-cross";
	}
	if (row === 5 || row === 9) return "path-horizontal";
	if (column === 4 || column === 9 || column === 14 || column === 20) {
		return "path-vertical";
	}
	if ((column * 5 + row * 7) % 17 === 0) return "grass-flowers";
	if ((column * 11 + row * 3) % 13 === 0) return "grass-tufts";
	return "grass";
}

export const marketplaceProps: RenderedProp<MarketplacePropKey>[] = [
	{ asset: "seed-shop", x: 190, y: 300, width: 220 },
	{ asset: "produce-stall", x: 575, y: 300, width: 245 },
	{ asset: "game-hall", x: 960, y: 300, width: 220 },
	{ asset: "seed-display", x: 145, y: 500, width: 115 },
	{ asset: "produce-cart", x: 375, y: 505, width: 160 },
	{ asset: "livestock-pavilion", x: 650, y: 545, width: 295 },
	{ asset: "village-bank", x: 1310, y: 545, width: 250 },
	{ asset: "hardware-store", x: 1230, y: 300, width: 220 },
	{ asset: "signpost", x: 660, y: 685, width: 88 },
	{ asset: "starter-train", x: 935, y: 735, width: 390 },
	{ asset: "oak-tree", x: 60, y: 205, width: 105 },
	{ asset: "pine-tree", x: 1090, y: 200, width: 100 },
	{ asset: "oak-tree", x: 1410, y: 205, width: 105 },
	{ asset: "daisies", x: 505, y: 465, width: 45 },
	{ asset: "marigolds", x: 765, y: 675, width: 45 },
	{ asset: "barrel", x: 490, y: 510, width: 48 },
	{ asset: "crate", x: 550, y: 510, width: 52 },
];
