import { CROPS, type CropId } from "../../shared/crops";
import {
	FISH,
	FISH_ORDER,
	type FishId,
	RODS,
	ROD_ORDER,
	type RodId,
} from "./fishingData";

/** The two enterable market stalls placed in the marketplace. */
export type MarketId = "seed" | "produce";

/** A buy/sell tab shown inside a market window. */
export type MarketCategoryId =
	| "seeds"
	| "tools"
	| "train"
	| "sell"
	| "fish"
	| "rods";

/**
 * A good that can be traded at a market. Produce ids double as crop ids, and
 * fish/rod ids double as their fishing ids.
 */
export type MarketItemId =
	| "tomato-seed"
	| "wheat-seed"
	| "lettuce-seed"
	| "tomato"
	| "wheat"
	| "lettuce"
	| "midas_wheat"
	| "frost_lettuce"
	| "sunburst_tomato"
	| FishId
	| RodId;

export interface MarketItem {
	id: MarketItemId;
	name: string;
	emoji: string;
	/** "buy" spends grangecoin, "sell" earns it. */
	kind: "buy" | "sell";
	/** Grangecoin spent or earned per unit. */
	price: number;
	/** Units granted or taken per transaction. */
	quantity: number;
	blurb: string;
}

function seedItem(id: MarketItemId, crop: CropId, emoji: string): MarketItem {
	const { name, seedCost } = CROPS[crop];
	return {
		id,
		name: `${name} Seeds`,
		emoji,
		kind: "buy",
		price: seedCost,
		quantity: 1,
		blurb: `$${seedCost} each`,
	};
}

function produceItem(id: MarketItemId, crop: CropId, emoji: string): MarketItem {
	const { name, sellValue } = CROPS[crop];
	return {
		id,
		name,
		emoji,
		kind: "sell",
		price: sellValue,
		quantity: 1,
		blurb: `$${sellValue} each`,
	};
}

function fishItem(id: FishId): MarketItem {
	const fish = FISH[id];
	return {
		id,
		name: fish.name,
		emoji: fish.emoji,
		kind: "sell",
		price: fish.value,
		quantity: 1,
		blurb: `$${fish.value} each`,
	};
}

function rodItem(id: RodId): MarketItem {
	const rod = RODS[id];
	return {
		id,
		name: rod.name,
		emoji: "🎣",
		kind: "buy",
		price: rod.cost,
		quantity: 1,
		blurb: `$${rod.cost.toLocaleString()} · ${rod.blurb}`,
	};
}

export const MARKET_ITEMS = {
	"tomato-seed": seedItem("tomato-seed", "tomato", "🌱"),
	"wheat-seed": seedItem("wheat-seed", "wheat", "🌱"),
	"lettuce-seed": seedItem("lettuce-seed", "lettuce", "🌱"),
	tomato: produceItem("tomato", "tomato", "🍅"),
	wheat: produceItem("wheat", "wheat", "🌾"),
	lettuce: produceItem("lettuce", "lettuce", "🥬"),
	midas_wheat: produceItem("midas_wheat", "midas_wheat", "🌟"),
	frost_lettuce: produceItem("frost_lettuce", "frost_lettuce", "❄️"),
	sunburst_tomato: produceItem("sunburst_tomato", "sunburst_tomato", "☀️"),
	...Object.fromEntries(FISH_ORDER.map((id) => [id, fishItem(id)])),
	...Object.fromEntries(ROD_ORDER.map((id) => [id, rodItem(id)])),
} as Record<MarketItemId, MarketItem>;

export interface MarketCategory {
	id: MarketCategoryId;
	label: string;
	description: string;
	/** Items sold here; empty squares fill the rest of the grid. */
	items: MarketItemId[];
	/** Total cells drawn in the grid. */
	slots: number;
}

export const MARKET_CATEGORIES: Record<MarketCategoryId, MarketCategory> = {
	seeds: {
		id: "seeds",
		label: "Seeds",
		description: "Buy seeds to plant on your farm.",
		items: ["wheat-seed", "lettuce-seed", "tomato-seed"],
		slots: 8,
	},
	tools: {
		id: "tools",
		label: "Tools",
		description: "Buy tools for working the fields.",
		items: [],
		slots: 8,
	},
	train: {
		id: "train",
		label: "Train",
		description: "Buy train carts and upgrades.",
		items: [],
		slots: 6,
	},
	sell: {
		id: "sell",
		label: "Sell",
		description: "Sell crops from your barn.",
		items: [
			"wheat",
			"lettuce",
			"tomato",
			"midas_wheat",
			"frost_lettuce",
			"sunburst_tomato",
		],
		slots: 12,
	},
	fish: {
		id: "fish",
		label: "Fish",
		description: "Sell your catch for grangecoin.",
		items: [...FISH_ORDER],
		slots: 12,
	},
	rods: {
		id: "rods",
		label: "Rods",
		description: "Upgrade your rod for better luck at the water.",
		items: [...ROD_ORDER],
		slots: 8,
	},
};

export interface MarketDefinition {
	id: MarketId;
	title: string;
	categories: MarketCategoryId[];
	/** Tab selected when the window first opens. */
	defaultCategory: MarketCategoryId;
}

export const MARKETS: Record<MarketId, MarketDefinition> = {
	seed: {
		id: "seed",
		title: "Seed Market",
		categories: ["seeds"],
		defaultCategory: "seeds",
	},
	produce: {
		id: "produce",
		title: "Produce Market",
		categories: ["sell", "fish", "rods", "tools", "train"],
		defaultCategory: "sell",
	},
};

/** Clamps a sell quantity into the 1..max range (at least 1). */
export function clampQuantity(value: number, max: number): number {
	const upper = Math.max(1, Math.floor(max));
	if (!Number.isFinite(value)) return 1;
	return Math.min(Math.max(1, Math.floor(value)), upper);
}

/** The server caps every seed stack at this many seeds. */
export const MAX_SEED_STACK = 99;

/**
 * The most seeds a buyer can purchase in one order. Limited by what their
 * balance affords and the remaining room in the seed stack; returns 0 when
 * even a single seed is out of reach.
 */
export function maxSeedPurchase(
	price: number,
	balance: number,
	owned: number,
): number {
	if (!Number.isFinite(price) || price <= 0) return 0;
	const affordable = Math.floor(Math.max(0, balance) / price);
	const room = Math.max(0, MAX_SEED_STACK - Math.max(0, Math.floor(owned)));
	return Math.max(0, Math.min(affordable, room));
}
