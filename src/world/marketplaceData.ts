import type { TerrainKey } from "./mapData";
import type { RenderedProp } from "./sceneRendering";

export type MarketplacePropKey =
	| "seed-shop"
	| "produce-stall"
	| "game-hall"
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

export function marketplaceTerrainAt(column: number, row: number): TerrainKey {
	if (
		(row === 5 || row === 9) &&
		(column === 4 || column === 9 || column === 14)
	) {
		return "path-cross";
	}
	if (row === 5 || row === 9) return "path-horizontal";
	if (column === 4 || column === 9 || column === 14) {
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
	{ asset: "notice-board", x: 650, y: 490, width: 140 },
	{ asset: "signpost", x: 660, y: 685, width: 88 },
	{ asset: "starter-train", x: 935, y: 735, width: 390 },
	{ asset: "oak-tree", x: 60, y: 205, width: 105 },
	{ asset: "pine-tree", x: 1090, y: 200, width: 100 },
	{ asset: "daisies", x: 505, y: 465, width: 45 },
	{ asset: "marigolds", x: 765, y: 675, width: 45 },
	{ asset: "barrel", x: 490, y: 510, width: 48 },
	{ asset: "crate", x: 550, y: 510, width: 52 },
];
