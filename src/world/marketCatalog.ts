import {
	CROPS,
	type CropId,
	matureStage,
	stageSprite,
} from "../../shared/crops";
import {
	MARKET_CATEGORIES,
	MARKETS,
	type MarketCategoryId,
	type MarketItemId,
} from "./marketData";

/** A seed offered in the Seed Stall's buy catalog. */
export interface SeedStallEntry {
	/** Market item id used by the purchase handler. */
	marketItemId: MarketItemId;
	cropId: CropId;
	name: string;
	/** Grangecoin cost, derived from the crop registry. */
	price: number;
	/** Seed-stage sprite URL under /assets. */
	sprite: string;
}

/** A crop offered in the Produce Stall's sell grid. */
export interface ProduceStallEntry {
	marketItemId: MarketItemId;
	cropId: CropId;
	name: string;
	/** Grangecoin earned, derived from the crop registry. */
	price: number;
	/** Mature-stage sprite URL under /assets. */
	sprite: string;
	rare: boolean;
	accent?: "gold" | "ice" | "sun";
}

/** Rare produce accent colours, mirroring the variant families. */
const RARE_ACCENT: Partial<Record<CropId, ProduceStallEntry["accent"]>> = {
	midas_wheat: "gold",
	frost_lettuce: "ice",
	sunburst_tomato: "sun",
};

function assetUrl(path: string): string {
	return `/assets/${path}`;
}

/** Finds the crop a market seed id plants, scanning the registry. */
function cropForSeedItemId(id: string): CropId | null {
	for (const cropId of Object.keys(CROPS) as CropId[]) {
		if (CROPS[cropId].seedId === id) return cropId;
	}
	return null;
}

/**
 * The Seed Stall's purchasable seeds. Sourced from the seed market category so
 * rare mutant seeds (drop-only) never appear here, with price and sprite
 * pulled straight from the crop registry.
 */
export const SEED_STALL_ITEMS: SeedStallEntry[] =
	MARKET_CATEGORIES.seeds.items.flatMap((id) => {
		const cropId = cropForSeedItemId(id);
		if (!cropId) return [];
		const def = CROPS[cropId];
		return [
			{
				marketItemId: id,
				cropId,
				name: `${def.name} Seeds`,
				price: def.seedCost,
				sprite: assetUrl(stageSprite(cropId, 0)),
			},
		];
	});

/**
 * The Produce Stall's crop grid, in barn order. Prices come from each crop's
 * `sellValue` and sprites from its mature growth stage.
 */
export const PRODUCE_STALL_ITEMS: ProduceStallEntry[] =
	MARKET_CATEGORIES.sell.items.flatMap((id) => {
		const cropId = id as CropId;
		if (!(cropId in CROPS)) return [];
		const def = CROPS[cropId];
		return [
			{
				marketItemId: id,
				cropId,
				name: def.name.toUpperCase(),
				price: def.sellValue,
				sprite: assetUrl(stageSprite(cropId, matureStage(cropId))),
				rare: def.variant === "rare",
				accent: RARE_ACCENT[cropId],
			},
		];
	});

/** Secondary produce-stall tabs (fish/rods/tools/train); the crop grid is first. */
export const PRODUCE_SECONDARY_TABS: MarketCategoryId[] =
	MARKETS.produce.categories.filter((id) => id !== "sell");
