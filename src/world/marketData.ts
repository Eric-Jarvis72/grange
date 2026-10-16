import { CROPS, type CropId } from "../../shared/crops";

/** The two enterable market stalls placed in the marketplace. */
export type MarketId = "seed" | "produce";

/** A buy/sell tab shown inside a market window. */
export type MarketCategoryId = "seeds" | "tools" | "train" | "sell";

/** A good that can be traded at a market. Produce ids double as crop ids. */
export type MarketItemId =
	| "tomato-seed"
	| "wheat-seed"
	| "lettuce-seed"
	| "tomato"
	| "wheat"
	| "lettuce"
	| "midas_wheat"
	| "frost_lettuce"
	| "sunburst_tomato";

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

export const MARKET_ITEMS: Record<MarketItemId, MarketItem> = {
	"tomato-seed": seedItem("tomato-seed", "tomato", "🌱"),
	"wheat-seed": seedItem("wheat-seed", "wheat", "🌱"),
	"lettuce-seed": seedItem("lettuce-seed", "lettuce", "🌱"),
	tomato: produceItem("tomato", "tomato", "🍅"),
	wheat: produceItem("wheat", "wheat", "🌾"),
	lettuce: produceItem("lettuce", "lettuce", "🥬"),
	midas_wheat: produceItem("midas_wheat", "midas_wheat", "🌟"),
	frost_lettuce: produceItem("frost_lettuce", "frost_lettuce", "❄️"),
	sunburst_tomato: produceItem("sunburst_tomato", "sunburst_tomato", "☀️"),
};

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
		categories: ["sell", "tools", "train"],
		defaultCategory: "sell",
	},
};

/** Clamps a sell quantity into the 1..max range (at least 1). */
export function clampQuantity(value: number, max: number): number {
	const upper = Math.max(1, Math.floor(max));
	if (!Number.isFinite(value)) return 1;
	return Math.min(Math.max(1, Math.floor(value)), upper);
}
