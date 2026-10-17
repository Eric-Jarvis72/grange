import type { CropId } from "../../shared/crops";
import type { FarmToolId } from "../../shared/farm";
import type { MovablePropKey } from "../world/mapData";

export type ItemId =
	| "hoe"
	| "watering-can"
	| "scythe"
	| "seed-bag"
	| "tomato"
	| "wheat"
	| "lettuce"
	| "midas_wheat"
	| "frost_lettuce"
	| "sunburst_tomato"
	| "wheat-seed"
	| "lettuce-seed"
	| "midas-wheat-seed"
	| "frost-lettuce-seed"
	| "sunburst-tomato-seed"
	| "fence"
	| "shovel"
	| MovablePropKey;

export type ItemKind = "tool" | "seed" | "crop" | "building";

export interface ItemDef {
	id: ItemId;
	name: string;
	kind: ItemKind;
	maxStack: number;
	/** Asset path (starts with "/") or emoji fallback for stub art. */
	icon: string;
	description: string;
}

export const ITEMS: Record<ItemId, ItemDef> = {
	hoe: {
		id: "hoe",
		name: "Hoe",
		kind: "tool",
		maxStack: 1,
		icon: "/assets/farm/objects/hoe.svg",
		description: "Till soil for planting.",
	},
	"watering-can": {
		id: "watering-can",
		name: "Watering Can",
		kind: "tool",
		maxStack: 1,
		icon: "/assets/farm/objects/watering-can.webp",
		description: "Water planted crops.",
	},
	scythe: {
		id: "scythe",
		name: "Scythe",
		kind: "tool",
		maxStack: 1,
		icon: "/assets/tools/scythe_basic.webp",
		description: "Harvest wheat and other sturdy crops.",
	},
	"seed-bag": {
		id: "seed-bag",
		name: "Tomato Seeds",
		kind: "seed",
		maxStack: 99,
		icon: "/assets/crops/tomato_0_seed.webp",
		description: "Plant tomato in tilled soil.",
	},
	tomato: {
		id: "tomato",
		name: "Tomato",
		kind: "crop",
		maxStack: 99,
		icon: "/assets/crops/tomato_harvested.webp",
		description: "Harvested crop. Sells for Grangecoin.",
	},
	wheat: {
		id: "wheat",
		name: "Wheat",
		kind: "crop",
		maxStack: 99,
		icon: "/assets/crops/wheat_harvested.webp",
		description: "Harvested crop. Sells for Grangecoin.",
	},
	lettuce: {
		id: "lettuce",
		name: "Lettuce",
		kind: "crop",
		maxStack: 99,
		icon: "/assets/crops/lettuce_harvested.webp",
		description: "Harvested crop. Sells for Grangecoin.",
	},
	midas_wheat: {
		id: "midas_wheat",
		name: "Midas Wheat",
		kind: "crop",
		maxStack: 99,
		icon: "/assets/crops/midas_wheat_harvested.webp",
		description: "A rare golden harvest. Sells for a premium.",
	},
	frost_lettuce: {
		id: "frost_lettuce",
		name: "Frost-Crisp Lettuce",
		kind: "crop",
		maxStack: 99,
		icon: "/assets/crops/frost_lettuce_harvested.webp",
		description: "A rare crisp harvest. Sells for a premium.",
	},
	sunburst_tomato: {
		id: "sunburst_tomato",
		name: "Sun-Burst Tomato",
		kind: "crop",
		maxStack: 99,
		icon: "/assets/crops/sunburst_tomato_harvested.webp",
		description: "A rare sun-ripened harvest. Sells for a premium.",
	},
	"wheat-seed": {
		id: "wheat-seed",
		name: "Wheat Seeds",
		kind: "seed",
		maxStack: 99,
		icon: "/assets/crops/wheat_0_seed.webp",
		description: "Plant wheat in tilled soil. Needs a scythe.",
	},
	"lettuce-seed": {
		id: "lettuce-seed",
		name: "Lettuce Seeds",
		kind: "seed",
		maxStack: 99,
		icon: "/assets/crops/lettuce_0_seed.webp",
		description: "Plant lettuce in tilled soil.",
	},
	"midas-wheat-seed": {
		id: "midas-wheat-seed",
		name: "Midas Wheat Seed",
		kind: "seed",
		maxStack: 99,
		icon: "/assets/crops/midas_wheat_0_seed.webp",
		description: "A rare golden wheat. Needs a scythe.",
	},
	"frost-lettuce-seed": {
		id: "frost-lettuce-seed",
		name: "Frost-Crisp Lettuce Seed",
		kind: "seed",
		maxStack: 99,
		icon: "/assets/crops/frost_lettuce_0_seed.webp",
		description: "A rare lettuce that waters its neighbours.",
	},
	"sunburst-tomato-seed": {
		id: "sunburst-tomato-seed",
		name: "Sun-Burst Tomato Seed",
		kind: "seed",
		maxStack: 99,
		icon: "/assets/crops/sunburst_tomato_0_sprout.webp",
		description: "A rare tomato that keeps producing.",
	},
	fence: {
		id: "fence", name: "Fence", kind: "building", maxStack: 99,
		icon: "/assets/farm/fences/post.webp",
		description: "Click grass to place a fence post. Adjacent posts connect automatically.",
	},
	shovel: {
		id: "shovel", name: "Shovel", kind: "tool", maxStack: 1,
		icon: "/assets/farm/objects/shovel.svg",
		description: "Click a fence or farm object to dig it up into inventory.",
	},
	farmhouse: { id: "farmhouse", name: "Farmhouse", kind: "building", maxStack: 99,
		icon: "/assets/farm/buildings/farmhouse.webp", description: "Place your farmhouse on clear ground." },
	barn: { id: "barn", name: "Barn", kind: "building", maxStack: 99,
		icon: "/assets/farm/buildings/barn.webp", description: "Place your barn on clear ground." },
	well: { id: "well", name: "Well", kind: "building", maxStack: 99,
		icon: "/assets/farm/objects/well.webp", description: "Place a well on clear ground." },
	bench: { id: "bench", name: "Bench", kind: "building", maxStack: 99,
		icon: "/assets/farm/objects/bench.webp", description: "Place a bench on clear ground." },
	sign: { id: "sign", name: "Sign", kind: "building", maxStack: 99,
		icon: "/assets/farm/objects/sign.webp", description: "Place a sign on clear ground." },
	barrel: { id: "barrel", name: "Barrel", kind: "building", maxStack: 99,
		icon: "/assets/farm/objects/barrel.webp", description: "Place a barrel on clear ground." },
	crate: { id: "crate", name: "Crate", kind: "building", maxStack: 99,
		icon: "/assets/farm/objects/crate.webp", description: "Place a crate on clear ground." },
	"oak-tree": { id: "oak-tree", name: "Oak Tree", kind: "building", maxStack: 99,
		icon: "/assets/farm/plants/oak-tree.webp", description: "Replant an oak tree." },
	"pine-tree": { id: "pine-tree", name: "Pine Tree", kind: "building", maxStack: 99,
		icon: "/assets/farm/plants/pine-tree.webp", description: "Replant a pine tree." },
	"apple-tree": { id: "apple-tree", name: "Apple Tree", kind: "building", maxStack: 99,
		icon: "/assets/farm/plants/apple-tree.webp", description: "Replant an apple tree." },
	daisies: { id: "daisies", name: "Daisies", kind: "building", maxStack: 99,
		icon: "/assets/farm/plants/daisies.webp", description: "Place a daisy bush." },
	marigolds: { id: "marigolds", name: "Marigolds", kind: "building", maxStack: 99,
		icon: "/assets/farm/plants/marigolds.webp", description: "Place a marigold bush." },
	"blue-flowers": { id: "blue-flowers", name: "Blue Flowers", kind: "building", maxStack: 99,
		icon: "/assets/farm/plants/blue-flowers.webp", description: "Place blue flowers." },
};

export function getItemDef(id: ItemId): ItemDef {
	return ITEMS[id];
}

export function isStackable(id: ItemId): boolean {
	return ITEMS[id].maxStack > 1;
}

/** Seed item -> crop it plants. */
export const SEED_CROPS: Partial<Record<ItemId, CropId>> = {
	"seed-bag": "tomato",
	"wheat-seed": "wheat",
	"lettuce-seed": "lettuce",
	"midas-wheat-seed": "midas_wheat",
	"frost-lettuce-seed": "frost_lettuce",
	"sunburst-tomato-seed": "sunburst_tomato",
};

/** Harvested produce item id -> crop. Each crop has its own item. */
export const CROP_ITEMS: Record<CropId, ItemId> = {
	wheat: "wheat",
	lettuce: "lettuce",
	tomato: "tomato",
	midas_wheat: "midas_wheat",
	frost_lettuce: "frost_lettuce",
	sunburst_tomato: "sunburst_tomato",
};

export function cropForSeedItem(itemId: ItemId | null | undefined): CropId | null {
	return itemId ? (SEED_CROPS[itemId] ?? null) : null;
}

/**
 * Maps a held inventory item to the farm action it performs. Selecting the
 * matching hotbar slot makes the hotbar the single tool selector.
 */
export function farmToolForItem(itemId: ItemId | null): FarmToolId | null {
	switch (itemId) {
		case "hoe":
			return "hoe";
		case "watering-can":
			return "bucket";
		case "scythe":
			return "scythe";
		default:
			return itemId && cropForSeedItem(itemId) ? "seed" : null;
	}
}
