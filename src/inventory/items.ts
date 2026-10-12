import type { FarmToolId } from "../../shared/farm";

export type ItemId =
	| "hoe"
	| "watering-can"
	| "scythe"
	| "seed-bag"
	| "tomato";

export type ItemKind = "tool" | "seed" | "crop";

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
		icon: "/assets/farm/objects/scythe.svg",
		description: "Harvest ready crops.",
	},
	"seed-bag": {
		id: "seed-bag",
		name: "Tomato Seeds",
		kind: "seed",
		maxStack: 99,
		icon: "/assets/farm/objects/seed-bag.webp",
		description: "Plant in tilled soil.",
	},
	tomato: {
		id: "tomato",
		name: "Tomato",
		kind: "crop",
		maxStack: 99,
		icon: "/assets/farm/plants/tomato-plant.webp",
		description: "Harvested crop. Sells for Grangecoin.",
	},
};

export function getItemDef(id: ItemId): ItemDef {
	return ITEMS[id];
}

export function isStackable(id: ItemId): boolean {
	return ITEMS[id].maxStack > 1;
}

/**
 * Maps a held inventory item to the farm action it performs. Selecting the
 * matching hotbar slot makes the hotbar the single tool selector.
 */
export function farmToolForItem(itemId: ItemId | null): FarmToolId | null {
	switch (itemId) {
		case "hoe":
			return "hoe";
		case "seed-bag":
			return "seed";
		case "watering-can":
			return "bucket";
		case "scythe":
			return "scythe";
		default:
			return null;
	}
}
