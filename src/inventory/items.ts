export type ItemId =
	| "hoe"
	| "watering-can"
	| "scythe"
	| "seed-bag"
	| "tomato"
	| "grangecoin";

export type ItemKind = "tool" | "seed" | "crop" | "currency";

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
		icon: "⛏️",
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
		icon: "🌾",
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
	grangecoin: {
		id: "grangecoin",
		name: "Grangecoin",
		kind: "currency",
		maxStack: 999,
		icon: "🪙",
		description: "Physical currency. Stackable, lives in slots.",
	},
};

export function getItemDef(id: ItemId): ItemDef {
	return ITEMS[id];
}

/** Grangecoin is intentionally an ordinary stackable item, not a counter. */
export function isStackable(id: ItemId): boolean {
	return ITEMS[id].maxStack > 1;
}
