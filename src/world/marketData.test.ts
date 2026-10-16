import { describe, expect, it } from "vitest";
import { CROPS } from "../../shared/crops";
import {
	clampQuantity,
	MARKET_CATEGORIES,
	MARKET_ITEMS,
	MARKETS,
} from "./marketData";

describe("market definitions", () => {
	it("gives the seed market a seeds tab", () => {
		expect(MARKETS.seed.categories).toEqual(["seeds"]);
		expect(MARKETS.seed.defaultCategory).toBe("seeds");
	});

	it("gives the produce market sell, tools, and train tabs", () => {
		expect(MARKETS.produce.categories).toEqual(["sell", "tools", "train"]);
		expect(MARKETS.produce.defaultCategory).toBe("sell");
	});

	it("lists every configured category and gives it empty slots", () => {
		for (const market of Object.values(MARKETS)) {
			for (const id of market.categories) {
				const category = MARKET_CATEGORIES[id];
				expect(category.id).toBe(id);
				expect(category.label.length).toBeGreaterThan(0);
				expect(category.slots).toBeGreaterThan(0);
			}
			expect(market.categories).toContain(market.defaultCategory);
		}
	});

	it("sells one seed per standard crop, priced from the crop registry", () => {
		expect(MARKET_CATEGORIES.seeds.items).toEqual([
			"wheat-seed",
			"lettuce-seed",
			"tomato-seed",
		]);

		const wheat = MARKET_ITEMS["wheat-seed"];
		expect(wheat.kind).toBe("buy");
		expect(wheat.price).toBe(CROPS.wheat.seedCost);
		expect(wheat.quantity).toBe(1);

		const tomato = MARKET_ITEMS["tomato-seed"];
		expect(tomato.price).toBe(CROPS.tomato.seedCost);
	});

	it("sells each produce item at its crop's value", () => {
		expect(MARKET_CATEGORIES.sell.items).toEqual([
			"wheat",
			"lettuce",
			"tomato",
			"midas_wheat",
			"frost_lettuce",
			"sunburst_tomato",
		]);

		const tomato = MARKET_ITEMS.tomato;
		expect(tomato.kind).toBe("sell");
		expect(tomato.price).toBe(CROPS.tomato.sellValue);
		expect(tomato.quantity).toBe(1);

		expect(MARKET_ITEMS.midas_wheat.price).toBe(CROPS.midas_wheat.sellValue);
	});

	it("clamps sell quantities into the 1..max range", () => {
		expect(clampQuantity(5, 10)).toBe(5);
		expect(clampQuantity(0, 10)).toBe(1);
		expect(clampQuantity(-4, 10)).toBe(1);
		expect(clampQuantity(99, 10)).toBe(10);
		expect(clampQuantity(3, 0)).toBe(1);
		expect(clampQuantity(Number.NaN, 10)).toBe(1);
	});
});
