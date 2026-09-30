import { describe, expect, it } from "vitest";
import {
	MAP_COLUMNS,
	MAP_HEIGHT,
	MAP_ROWS,
	MAP_WIDTH,
	TILE_SIZE,
	props,
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

	it("starts the entire crop field with dry soil", () => {
		for (let row = 6; row <= 8; row += 1) {
			for (let column = 7; column <= 11; column += 1) {
				expect(terrainAt(column, row)).toBe("tilled-dry");
			}
		}
	});

	it("creates the main path intersection", () => {
		expect(terrainAt(4, 4)).toBe("path-cross");
		expect(terrainAt(5, 4)).toBe("path-horizontal");
		expect(terrainAt(4, 5)).toBe("path-vertical");
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
});
