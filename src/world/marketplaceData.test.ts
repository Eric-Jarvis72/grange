import { describe, expect, it } from "vitest";
import { MAP_HEIGHT } from "./mapData";
import {
	MARKETPLACE_PRODUCE_MARKET_ENTRANCE,
	MARKETPLACE_SEED_MARKET_ENTRANCE,
	MARKETPLACE_TRAIN_STOP,
	MARKETPLACE_WIDTH,
	MARKETPLACE_BANK_ENTRANCE,
	marketplaceProps,
	marketplaceTerrainAt,
} from "./marketplaceData";

describe("marketplace map data", () => {
	it("creates two main paths with three intersections", () => {
		for (const row of [5, 9]) {
			expect(marketplaceTerrainAt(3, row)).toBe("path-horizontal");
			for (const column of [4, 9, 14]) {
				expect(marketplaceTerrainAt(column, row)).toBe("path-cross");
			}
		}
	});

	it("includes each marketplace building and the return train", () => {
		const assets = marketplaceProps.map((prop) => prop.asset);
		expect(assets).toContain("seed-shop");
		expect(assets).toContain("produce-stall");
		expect(assets).toContain("game-hall");
		expect(assets).toContain("livestock-pavilion");
		expect(assets).toContain("village-bank");
		expect(assets).toContain("starter-train");
		expect(assets).not.toContain("card-table");
		expect(assets).not.toContain("slot-machine");
	});

	it("keeps every prop and train stop within the map", () => {
		for (const prop of marketplaceProps) {
			expect(prop.width).toBeGreaterThan(0);
			expect(prop.x - prop.width / 2).toBeGreaterThanOrEqual(0);
			expect(prop.x + prop.width / 2).toBeLessThanOrEqual(MARKETPLACE_WIDTH);
			expect(prop.y).toBeGreaterThanOrEqual(0);
			expect(prop.y).toBeLessThanOrEqual(MAP_HEIGHT);
		}
		expect(MARKETPLACE_TRAIN_STOP.x).toBeGreaterThanOrEqual(0);
		expect(MARKETPLACE_TRAIN_STOP.x).toBeLessThanOrEqual(MARKETPLACE_WIDTH);
		expect(MARKETPLACE_TRAIN_STOP.y).toBeGreaterThanOrEqual(0);
		expect(MARKETPLACE_TRAIN_STOP.y).toBeLessThanOrEqual(MAP_HEIGHT);
	});

	it("places both market entrances within the map", () => {
		for (const entrance of [
			MARKETPLACE_SEED_MARKET_ENTRANCE,
			MARKETPLACE_PRODUCE_MARKET_ENTRANCE,
			MARKETPLACE_BANK_ENTRANCE,
		]) {
			expect(entrance.x).toBeGreaterThanOrEqual(0);
			expect(entrance.x).toBeLessThanOrEqual(MARKETPLACE_WIDTH);
			expect(entrance.y).toBeGreaterThanOrEqual(0);
			expect(entrance.y).toBeLessThanOrEqual(MAP_HEIGHT);
		}
	});
});
