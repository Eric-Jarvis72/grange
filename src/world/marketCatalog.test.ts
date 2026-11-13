import { describe, expect, it } from "vitest";
import {
	CROPS,
	type CropId,
	matureStage,
	stageSprite,
} from "../../shared/crops";
import {
	PRODUCE_SECONDARY_TABS,
	PRODUCE_STALL_ITEMS,
	SEED_STALL_ITEMS,
} from "./marketCatalog";
import { MARKET_CATEGORIES } from "./marketData";

describe("seed stall catalog", () => {
	it("lists only the standard seeds from the seed category", () => {
		expect(SEED_STALL_ITEMS.map((entry) => entry.marketItemId)).toEqual([
			"wheat-seed",
			"lettuce-seed",
			"tomato-seed",
		]);
		expect(SEED_STALL_ITEMS.map((entry) => entry.cropId)).toEqual([
			"wheat",
			"lettuce",
			"tomato",
		]);
		expect(MARKET_CATEGORIES.seeds.items).toEqual(
			SEED_STALL_ITEMS.map((entry) => entry.marketItemId),
		);
	});

	it("derives every price and seed sprite from the crop registry", () => {
		for (const entry of SEED_STALL_ITEMS) {
			const def = CROPS[entry.cropId];
			expect(entry.price).toBe(def.seedCost);
			expect(entry.sprite).toBe(`/assets/${stageSprite(entry.cropId, 0)}`);
			expect(entry.name).toBe(`${def.name} Seeds`);
		}
		expect(SEED_STALL_ITEMS[0].sprite).toBe("/assets/crops/wheat_0_seed.webp");
		expect(SEED_STALL_ITEMS[1].sprite).toBe(
			"/assets/crops/lettuce_0_seed.webp",
		);
		expect(SEED_STALL_ITEMS[2].sprite).toBe("/assets/crops/tomato_0_seed.webp");
	});

	it("never offers drop-only rare mutant seeds", () => {
		const ids = SEED_STALL_ITEMS.map((entry) => entry.cropId);
		expect(ids).not.toContain("midas_wheat");
		expect(ids).not.toContain("frost_lettuce");
		expect(ids).not.toContain("sunburst_tomato");
	});
});

describe("produce stall catalog", () => {
	it("matches the barn sell order from marketData", () => {
		expect(PRODUCE_STALL_ITEMS.map((entry) => entry.cropId)).toEqual(
			MARKET_CATEGORIES.sell.items,
		);
		expect(PRODUCE_STALL_ITEMS).toHaveLength(6);
	});

	it("derives every price and mature sprite from the crop registry", () => {
		for (const entry of PRODUCE_STALL_ITEMS) {
			const def = CROPS[entry.cropId];
			expect(entry.price).toBe(def.sellValue);
			expect(entry.name).toBe(def.name.toUpperCase());
			expect(entry.sprite).toBe(
				`/assets/${stageSprite(entry.cropId, matureStage(entry.cropId))}`,
			);
		}
	});

	it("uses the requested mature sprites", () => {
		const spriteOf = (cropId: CropId) =>
			PRODUCE_STALL_ITEMS.find((entry) => entry.cropId === cropId)?.sprite;
		expect(spriteOf("wheat")).toBe("/assets/crops/wheat_4_mature.webp");
		expect(spriteOf("lettuce")).toBe("/assets/crops/lettuce_4_mature.webp");
		expect(spriteOf("tomato")).toBe("/assets/crops/tomato_4_mature.webp");
		expect(spriteOf("midas_wheat")).toBe(
			"/assets/crops/midas_wheat_3_mature.webp",
		);
		expect(spriteOf("frost_lettuce")).toBe(
			"/assets/crops/frost_lettuce_3_mature.webp",
		);
		expect(spriteOf("sunburst_tomato")).toBe(
			"/assets/crops/sunburst_tomato_2_mature.webp",
		);
	});

	it("flags rare variants with distinct accents", () => {
		const byCrop = Object.fromEntries(
			PRODUCE_STALL_ITEMS.map((entry) => [entry.cropId, entry]),
		);
		expect(byCrop.wheat.rare).toBe(false);
		expect(byCrop.lettuce.rare).toBe(false);
		expect(byCrop.tomato.rare).toBe(false);
		expect(byCrop.midas_wheat).toMatchObject({ rare: true, accent: "gold" });
		expect(byCrop.frost_lettuce).toMatchObject({ rare: true, accent: "ice" });
		expect(byCrop.sunburst_tomato).toMatchObject({ rare: true, accent: "sun" });
	});
});

describe("produce secondary tabs", () => {
	it("keeps fish, rods, tools, and train off the crop grid", () => {
		expect(PRODUCE_SECONDARY_TABS).toEqual(["fish", "rods", "tools", "train"]);
		expect(PRODUCE_SECONDARY_TABS).not.toContain("sell");
	});
});
