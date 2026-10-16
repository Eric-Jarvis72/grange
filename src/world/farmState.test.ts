// biome-ignore-all lint/style/noNonNullAssertion: tests assert on tiles they just created
import { describe, expect, it } from "vitest";
import { CROPS } from "../../shared/crops";
import { FARM_GROW_MS } from "../../shared/farm";
import { MAP_COLUMNS, MAP_ROWS } from "./mapData";
import {
	cropStageIndex,
	LocalFarmStore,
	synergyActive,
} from "./farmState";

describe("cropStageIndex", () => {
	it("maps tile states to variable stage counts", () => {
		const farm = new LocalFarmStore();
		farm.tillGround(2, 2);
		farm.plantSeed(2, 2, "tomato", 1_000);
		expect(cropStageIndex(farm.getTile(2, 2)!, 1_000)).toBe(0);
		farm.waterTile(2, 2, 1_000);
		expect(cropStageIndex(farm.getTile(2, 2)!, 1_000 + FARM_GROW_MS)).toBe(4);
	});

	it("uses three stages for Sun-Burst Tomato and four for Midas Wheat", () => {
		expect(CROPS.sunburst_tomato.stages).toHaveLength(3);
		expect(CROPS.midas_wheat.stages).toHaveLength(4);
		expect(CROPS.wheat.stages).toHaveLength(5);
	});
});

describe("LocalFarmStore bounds", () => {
	it("covers the full map grid", () => {
		const farm = new LocalFarmStore();
		expect(farm.tillGround(0, 0)).toBe(true);
		expect(farm.tillGround(MAP_COLUMNS - 1, MAP_ROWS - 1)).toBe(true);
		expect(farm.tillGround(MAP_COLUMNS, 0)).toBe(false);
		expect(farm.tillGround(0, MAP_ROWS)).toBe(false);
		expect(farm.tillGround(-1, 0)).toBe(false);
		expect(farm.getTile(MAP_COLUMNS, 0)).toBeUndefined();
	});
});

describe("LocalFarmStore lifecycle", () => {
	it("till -> plant -> water -> tick -> hand harvest yields produce", () => {
		const farm = new LocalFarmStore();
		farm.tillGround(8, 7);
		expect(farm.plantSeed(8, 7, "tomato", 1_000)).toBe(true);
		expect(farm.waterTile(8, 7, 1_000)).toBe(true);
		expect(farm.getTile(8, 7)).toMatchObject({ state: "watered" });

		expect(farm.tick(1_000 + FARM_GROW_MS - 1)).toHaveLength(0);
		expect(farm.tick(1_000 + FARM_GROW_MS)).toEqual([{ x: 8, y: 7 }]);

		const result = farm.harvestCrop(8, 7, { tool: "hand" });
		expect(result.ok).toBe(true);
		expect(farm.produceCount("tomato")).toBe(1);
	});

	it("rejects out-of-order actions", () => {
		const farm = new LocalFarmStore();
		expect(farm.plantSeed(1, 1)).toBe(false);
		expect(farm.waterTile(1, 1)).toBe(false);
		expect(farm.harvestCrop(1, 1).ok).toBe(false);
		expect(farm.tillGround(1, 1)).toBe(true);
		expect(farm.tillGround(1, 1)).toBe(false);
		expect(farm.waterTile(1, 1)).toBe(false);
		expect(farm.plantSeed(1, 1)).toBe(true);
		expect(farm.plantSeed(1, 1)).toBe(false);
	});
});

describe("harvest requirements", () => {
	it("requires a scythe for wheat and refuses a hand harvest", () => {
		const farm = new LocalFarmStore();
		farm.tillGround(3, 3);
		farm.plantSeed(3, 3, "wheat", 0);
		farm.waterTile(3, 3, 0);
		farm.tick(FARM_GROW_MS);

		const hand = farm.harvestCrop(3, 3, { tool: "hand" });
		expect(hand.ok).toBe(false);
		expect(farm.getTile(3, 3)?.state).toBe("ready");

		expect(farm.harvestCrop(3, 3, { tool: "scythe" }).ok).toBe(true);
		expect(farm.produceCount("wheat")).toBe(1);
	});

	it("regrows tomatoes once before clearing", () => {
		const farm = new LocalFarmStore();
		farm.tillGround(5, 5);
		farm.plantSeed(5, 5, "tomato", 0);
		farm.waterTile(5, 5, 0);
		farm.tick(FARM_GROW_MS);

		expect(farm.harvestCrop(5, 5, { tool: "hand", now: FARM_GROW_MS }).ok).toBe(true);
		const tile = farm.getTile(5, 5)!;
		expect(tile.state).toBe("watered");
		expect(tile.harvestsRemaining).toBe(1);
		expect(tile.regrowFrom).toBe(CROPS.tomato.regrowStage);

		const secondReady = tile.readyAt!;
		expect(farm.tick(secondReady)).toEqual([{ x: 5, y: 5 }]);
		expect(farm.harvestCrop(5, 5, { tool: "hand" }).ok).toBe(true);
		expect(farm.getTile(5, 5)?.state).toBe("tilled");
		expect(farm.produceCount("tomato")).toBe(2);
	});
});

describe("grid synergy", () => {
	it("grows packed wheat faster than isolated wheat", () => {
		const farm = new LocalFarmStore();
		farm.tillGround(2, 2);
		farm.tillGround(3, 2);
		farm.plantSeed(2, 2, "wheat", 0);
		farm.plantSeed(3, 2, "wheat", 0);
		farm.tillGround(10, 10);
		farm.plantSeed(10, 10, "wheat", 0);

		farm.waterTile(2, 2, 0);
		farm.waterTile(10, 10, 0);
		const packedReady = farm.getTile(2, 2)!.readyAt!;
		const loneReady = farm.getTile(10, 10)!.readyAt!;
		expect(packedReady).toBeLessThan(loneReady);
	});

	it("slows crowding tomatoes and speeds up lettuced tomatoes", () => {
		const farm = new LocalFarmStore();
		farm.tillGround(1, 1);
		farm.tillGround(2, 1);
		farm.plantSeed(1, 1, "tomato", 0);
		farm.plantSeed(2, 1, "tomato", 0);
		farm.waterTile(1, 1, 0);

		farm.tillGround(6, 6);
		farm.tillGround(7, 6);
		farm.plantSeed(6, 6, "tomato", 0);
		farm.plantSeed(7, 6, "lettuce", 0);
		farm.waterTile(6, 6, 0);

		expect(farm.getTile(1, 1)!.readyAt!).toBeGreaterThan(FARM_GROW_MS);
		expect(farm.getTile(6, 6)!.readyAt!).toBeLessThan(FARM_GROW_MS);
	});

	it("reports active synergy for supported arrangements", () => {
		const farm = new LocalFarmStore();
		farm.tillGround(4, 4);
		farm.tillGround(5, 4);
		farm.tillGround(6, 4);
		farm.plantSeed(5, 4, "wheat", 0);
		farm.plantSeed(4, 4, "wheat", 0);
		expect(synergyActive(farm.getTile(5, 4)!, (x, y) => farm.getTile(x, y))).toBe(false);
		farm.plantSeed(6, 4, "wheat", 0);
		expect(synergyActive(farm.getTile(5, 4)!, (x, y) => farm.getTile(x, y))).toBe(true);
	});
});

describe("rare mutations", () => {
	it("drops a mutation seed when the roll succeeds", () => {
		const farm = new LocalFarmStore();
		farm.tillGround(2, 2);
		farm.plantSeed(2, 2, "lettuce", 0);
		farm.waterTile(2, 2, 0);
		farm.tick(FARM_GROW_MS);

		const result = farm.harvestCrop(2, 2, {
			tool: "hand",
			comboCount: 15,
			rng: () => 0,
		});
		expect(result.mutationSeed).toBe("frost-lettuce-seed");
		expect(farm.seedCount("frost-lettuce-seed")).toBe(1);
	});

	it("does not drop when the roll fails", () => {
		const farm = new LocalFarmStore();
		farm.tillGround(2, 2);
		farm.plantSeed(2, 2, "lettuce", 0);
		farm.waterTile(2, 2, 0);
		farm.tick(FARM_GROW_MS);

		const result = farm.harvestCrop(2, 2, {
			tool: "hand",
			comboCount: 0,
			rng: () => 0.999,
		});
		expect(result.mutationSeed).toBeUndefined();
	});

	it("grants Midas Wheat a combo bonus and Sun-Burst a bonus seed", () => {
		const farm = new LocalFarmStore();
		farm.tillGround(0, 0);
		farm.plantSeed(0, 0, "midas_wheat", 0);
		farm.waterTile(0, 0, 0);
		farm.tick(FARM_GROW_MS);
		expect(farm.harvestCrop(0, 0, { tool: "scythe" }).comboBonus).toBe(3);

		farm.tillGround(1, 0);
		farm.plantSeed(1, 0, "sunburst_tomato", 0);
		farm.waterTile(1, 0, 0);
		farm.tick(FARM_GROW_MS * 2);
		const result = farm.harvestCrop(1, 0, { tool: "hand", rng: () => 0 });
		expect(result.bonusSeed).toBe("tomato-seed");
	});
});

describe("passive watering", () => {
	it("lets mature Frost-Crisp Lettuce water its neighbours", () => {
		const farm = new LocalFarmStore();
		farm.tillGround(7, 7);
		farm.plantSeed(7, 7, "frost_lettuce", 0);
		farm.waterTile(7, 7, 0);
		farm.tick(FARM_GROW_MS);
		expect(farm.getTile(7, 7)?.state).toBe("ready");

		farm.tillGround(7, 8);
		farm.plantSeed(7, 8, "tomato", 0);
		farm.tick(FARM_GROW_MS + 1);
		expect(farm.getTile(7, 8)?.state).toBe("watered");
	});
});
