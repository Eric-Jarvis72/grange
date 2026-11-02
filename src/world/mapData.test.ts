import { describe, expect, it } from "vitest";
import {
	ANIMATED_PROPS,
	farmBounds,
	FARM_TRAIN_ENGINE_STOP,
	FARM_TRAIN_STOP,
	isNearFarmTrain,
		isTillableTile,
		ownsFarmTile,
	MAP_COLUMNS,
	MAP_HEIGHT,
	MAP_ROWS,
	MAP_WIDTH,
	propBlocking,
	props,
	TILE_SIZE,
	terrainAt,
} from "./mapData";

describe("farm map data", () => {
	it("uses a 64px, 18 by 12 tile map", () => {
		expect(TILE_SIZE).toBe(64);
		expect(MAP_WIDTH).toBe(MAP_COLUMNS * TILE_SIZE);
		expect(MAP_HEIGHT).toBe(MAP_ROWS * TILE_SIZE);
	});

	it("places water and shoreline along the bottom", () => {
		for (let column = 0; column < MAP_COLUMNS; column += 1) {
			expect(terrainAt(column, 10)).toBe("shore-north");
			expect(terrainAt(column, 11)).toBe("water");
		}
	});

	it("starts the crop field as plantable grass", () => {
		for (let row = 6; row <= 8; row += 1) {
			for (let column = 7; column <= 11; column += 1) {
				expect(isTillableTile(column, row)).toBe(true);
				expect(terrainAt(column, row)).not.toBe("tilled-dry");
			}
		}
	});

	it("only allows hoeing on grass", () => {
		expect(isTillableTile(0, 0)).toBe(true);
		expect(isTillableTile(5, 4)).toBe(true);
		expect(isTillableTile(4, 5)).toBe(true);
		expect(isTillableTile(0, 10)).toBe(false);
		expect(isTillableTile(0, 11)).toBe(false);
	});

	it("assigns a blocking rule to every prop", () => {
		const assets = new Set(props.map((prop) => prop.asset));
		for (const asset of assets) {
			expect(propBlocking[asset]).toBeDefined();
		}
		expect(propBlocking.farmhouse).toBe("rect");
		expect(propBlocking.well).toBe("rect");
		expect(propBlocking["oak-tree"]).toBe("base");
		expect(propBlocking.daisies).toBe("base");
		expect(propBlocking.marigolds).toBe("base");
		expect(propBlocking["blue-flowers"]).toBe("base");
	});

	it("keeps the original farm usable and expands beyond its edges", () => {
		expect(ownsFarmTile(7, 7, 0)).toBe(true);
		expect(ownsFarmTile(7, 2, 0)).toBe(true);
		expect(ownsFarmTile(7, -1, 0)).toBe(false);
		expect(ownsFarmTile(7, -1, 1)).toBe(true);
		expect(ownsFarmTile(-1, 7, 2)).toBe(true);
		expect(ownsFarmTile(18, 7, 3)).toBe(true);
		expect(ownsFarmTile(7, -3, 4)).toBe(true);
		expect(farmBounds(0)).toEqual({ minColumn: 0, maxColumn: 17, minRow: 0, maxRow: 11 });
		expect(ownsFarmTile(0, 11, 4)).toBe(false);
	});

	it("keeps props within the map", () => {
		for (const prop of props) {
			expect(prop.width).toBeGreaterThan(0);
			expect(prop.x - prop.width / 2).toBeGreaterThanOrEqual(0);
			expect(prop.x + prop.width / 2).toBeLessThanOrEqual(MAP_WIDTH);
			expect(prop.y).toBeGreaterThanOrEqual(0);
			expect(prop.y).toBeLessThanOrEqual(MAP_HEIGHT);
		}
	});

	it("includes a starter train with an in-bounds interaction point", () => {
		expect(props.some((prop) => prop.asset === "starter-train")).toBe(true);
		expect(FARM_TRAIN_STOP.x).toBeGreaterThanOrEqual(0);
		expect(FARM_TRAIN_STOP.x).toBeLessThanOrEqual(MAP_WIDTH);
		expect(FARM_TRAIN_STOP.y).toBeGreaterThanOrEqual(0);
		expect(FARM_TRAIN_STOP.y).toBeLessThanOrEqual(MAP_HEIGHT);
		expect(FARM_TRAIN_ENGINE_STOP.x).toBeLessThanOrEqual(MAP_WIDTH);
	});

	it("offers train travel beside both the cart and engine", () => {
		expect(isNearFarmTrain(790, 530)).toBe(true);
		expect(isNearFarmTrain(925, 530)).toBe(true);
		expect(isNearFarmTrain(1050, 530)).toBe(true);
		expect(isNearFarmTrain(1130, 530)).toBe(true);
		expect(isNearFarmTrain(1060, 450)).toBe(false);
	});

	it("marks the train as scene-animated so static renderers skip it", () => {
		expect(ANIMATED_PROPS.has("starter-train")).toBe(true);
		for (const prop of props) {
			if (prop.asset === "starter-train") continue;
			expect(ANIMATED_PROPS.has(prop.asset)).toBe(false);
		}
	});
});
