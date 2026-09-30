import { beforeEach, describe, expect, it, vi } from "vitest";
import {
	FARM_GRID_SIZE,
	FARM_GROW_MS,
	FARM_HARVEST_YIELD,
} from "../shared/farm";
import { InMemoryFarmStore } from "./farm";
import { startFarmTicker } from "./farmTicker";

let farm: InMemoryFarmStore;

beforeEach(() => {
	farm = new InMemoryFarmStore();
});

describe("farm grid bounds", () => {
	it(`uses a ${FARM_GRID_SIZE}x${FARM_GRID_SIZE} grid`, () => {
		expect(FARM_GRID_SIZE).toBe(15);
	});

	it("rejects out-of-bounds coordinates on every action", () => {
		for (const [x, y] of [
			[-1, 0],
			[0, -1],
			[FARM_GRID_SIZE, 0],
			[0, FARM_GRID_SIZE],
		] as const) {
			expect(farm.tillGround("p1", x, y)).toBe(false);
			expect(farm.plantSeed("p1", x, y)).toBe(false);
			expect(farm.waterTile("p1", x, y)).toBe(false);
			expect(farm.harvestCrop("p1", x, y)).toBe(false);
			expect(farm.getTile("p1", x, y)).toBeUndefined();
		}
	});
});

describe("tillGround", () => {
	it("tills an empty tile and stores it", () => {
		expect(farm.tillGround("p1", 2, 3)).toBe(true);
		expect(farm.getTile("p1", 2, 3)).toMatchObject({
			x: 2,
			y: 3,
			state: "tilled",
			cropId: "tomato",
		});
	});

	it("returns false when tilling an already-tilled tile", () => {
		expect(farm.tillGround("p1", 1, 1)).toBe(true);
		expect(farm.tillGround("p1", 1, 1)).toBe(false);
	});
});

describe("plantSeed", () => {
	it("plants on tilled soil (infinite seeds for testing)", () => {
		farm.tillGround("p1", 4, 4);
		expect(farm.plantSeed("p1", 4, 4, 777)).toBe(true);
		expect(farm.getTile("p1", 4, 4)).toMatchObject({
			state: "planted",
			plantedAt: 777,
		});
	});

	it("rejects planting on untilled ground", () => {
		expect(farm.plantSeed("p1", 5, 5)).toBe(false);
		expect(farm.getTile("p1", 5, 5)).toBeUndefined();
	});

	it("rejects double-planting", () => {
		farm.tillGround("p1", 4, 4);
		farm.plantSeed("p1", 4, 4);
		expect(farm.plantSeed("p1", 4, 4)).toBe(false);
	});
});

describe("waterTile", () => {
	it("waters a planted tile and schedules readiness", () => {
		farm.tillGround("p1", 0, 0);
		farm.plantSeed("p1", 0, 0);
		expect(farm.waterTile("p1", 0, 0, 1000)).toBe(true);
		expect(farm.getTile("p1", 0, 0)).toMatchObject({
			state: "watered",
			wateredAt: 1000,
			readyAt: 1000 + FARM_GROW_MS,
		});
	});

	it("rejects watering unplanted or already-watered tiles", () => {
		farm.tillGround("p1", 0, 1);
		expect(farm.waterTile("p1", 0, 1)).toBe(false);
		farm.plantSeed("p1", 0, 1);
		expect(farm.waterTile("p1", 0, 1)).toBe(true);
		expect(farm.waterTile("p1", 0, 1)).toBe(false);
	});
});

describe("growth timer", () => {
	it(`defaults to ${FARM_GROW_MS}ms and is adjustable per call`, () => {
		expect(FARM_GROW_MS).toBe(10_000);
		farm.tillGround("p1", 6, 6);
		farm.plantSeed("p1", 6, 6);
		farm.waterTile("p1", 6, 6, 0, 5000);
		expect(farm.getTile("p1", 6, 6)?.readyAt).toBe(5000);
		expect(farm.tickFarm(4999)).toHaveLength(0);
		expect(farm.tickFarm(5000)).toHaveLength(1);
		expect(farm.getTile("p1", 6, 6)?.state).toBe("ready");
	});

	it("flips watered tiles to ready via active tick", () => {
		farm.tillGround("p1", 7, 7);
		farm.plantSeed("p1", 7, 7);
		farm.waterTile("p1", 7, 7, 0);
		expect(farm.tickFarm(FARM_GROW_MS - 1)).toHaveLength(0);
		expect(farm.getTile("p1", 7, 7)?.state).toBe("watered");
		const ready = farm.tickFarm(FARM_GROW_MS);
		expect(ready).toEqual([{ player: "p1", x: 7, y: 7 }]);
		expect(farm.getTile("p1", 7, 7)?.state).toBe("ready");
	});

	it("pushes ready tiles through the ticker callback", () => {
		vi.useFakeTimers();
		try {
			const onReady = vi.fn();
			const stop = startFarmTicker(farm, onReady, { intervalMs: 1000 });
			try {
				farm.tillGround("p1", 1, 2);
				farm.plantSeed("p1", 1, 2);
				farm.waterTile("p1", 1, 2, Date.now());
				vi.advanceTimersByTime(FARM_GROW_MS);
				expect(onReady).toHaveBeenCalledWith([{ player: "p1", x: 1, y: 2 }]);
				expect(farm.getTile("p1", 1, 2)?.state).toBe("ready");
			} finally {
				stop();
			}
		} finally {
			vi.useRealTimers();
		}
	});
});

describe("harvestCrop", () => {
	it("rejects harvesting before the crop is ready", () => {
		farm.tillGround("p1", 3, 3);
		farm.plantSeed("p1", 3, 3);
		farm.waterTile("p1", 3, 3, 0);
		expect(farm.harvestCrop("p1", 3, 3)).toBe(false);
	});

	it(`yields ${FARM_HARVEST_YIELD} tomatoes and resets to tilled (not watered)`, () => {
		expect(FARM_HARVEST_YIELD).toBe(3);
		expect(farm.getInventory("p1").tomato).toBe(0);
		farm.tillGround("p1", 3, 3);
		farm.plantSeed("p1", 3, 3);
		farm.waterTile("p1", 3, 3, 0);
		farm.tickFarm(FARM_GROW_MS);
		expect(farm.harvestCrop("p1", 3, 3)).toBe(true);
		expect(farm.getInventory("p1").tomato).toBe(3);
		expect(farm.getTile("p1", 3, 3)).toMatchObject({
			state: "tilled",
			wateredAt: undefined,
			readyAt: undefined,
		});
	});
});

describe("per-player isolation", () => {
	it("keeps each player's farm and inventory separate", () => {
		farm.tillGround("alice", 0, 0);
		farm.plantSeed("alice", 0, 0);
		farm.waterTile("alice", 0, 0, 0);
		farm.tickFarm(FARM_GROW_MS);
		farm.harvestCrop("alice", 0, 0);

		expect(farm.getTile("bob", 0, 0)).toBeUndefined();
		expect(farm.getInventory("bob").tomato).toBe(0);
		expect(farm.getInventory("alice").tomato).toBe(3);
		expect(farm.getTile("alice", 0, 0)?.state).toBe("tilled");
	});
});

describe("full tomato lifecycle", () => {
	it("till -> plant -> water -> tick -> harvest", () => {
		const states: string[] = [];
		expect(farm.tillGround("p1", 9, 9)).toBe(true);
		states.push(farm.getTile("p1", 9, 9)?.state ?? "missing");
		expect(farm.plantSeed("p1", 9, 9)).toBe(true);
		states.push(farm.getTile("p1", 9, 9)?.state ?? "missing");
		expect(farm.waterTile("p1", 9, 9, 0)).toBe(true);
		states.push(farm.getTile("p1", 9, 9)?.state ?? "missing");
		farm.tickFarm(FARM_GROW_MS);
		states.push(farm.getTile("p1", 9, 9)?.state ?? "missing");
		expect(farm.harvestCrop("p1", 9, 9)).toBe(true);
		states.push(farm.getTile("p1", 9, 9)?.state ?? "missing");
		expect(states).toEqual(["tilled", "planted", "watered", "ready", "tilled"]);
		expect(farm.getInventory("p1").tomato).toBe(3);
	});
});
