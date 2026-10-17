import { describe, expect, it } from "vitest";
import { fenceBlockedTiles } from "./fenceData";
import {
	BlockRegistry,
	decorByTile,
	groundFootprintTiles,
	rectFootprintTiles,
	tileKey,
} from "./blocking";
import { propBlocking, props } from "./mapData";

// Height/width ratios measured from the assets in public/assets/farm.
const ASPECTS: Record<string, number> = {
	farmhouse: 562 / 581,
	barn: 593 / 587,
	well: 315 / 291,
	bench: 222 / 318,
	sign: 271 / 203,
	barrel: 250 / 206,
	crate: 210 / 226,
};

function keySet(tiles: Array<{ column: number; row: number }>): Set<string> {
	return new Set(tiles.map((tile) => tileKey(tile.column, tile.row)));
}

describe("rectFootprintTiles", () => {
	it("covers every tile a rect touches", () => {
		const tiles = keySet(rectFootprintTiles(465, 380, 86, 49));
		expect(tiles).toEqual(new Set(["6,5", "7,5"]));
	});

	it("spans rows when a rail straddles a boundary", () => {
		const tiles = keySet(rectFootprintTiles(555, 590, 86, 49));
		expect(tiles).toEqual(new Set(["8,8", "9,8", "8,9", "9,9"]));
	});

	it("includes sliver overlaps under the strict rule", () => {
		const tiles = keySet(rectFootprintTiles(735, 380, 86, 49));
		expect(tiles.has("12,5")).toBe(true);
	});

	it("does not bleed across an exact tile boundary", () => {
		const tiles = keySet(rectFootprintTiles(725, 380, 86, 49));
		expect(tiles.has("12,5")).toBe(false);
		expect(tiles.has("11,5")).toBe(true);
	});
});

describe("groundFootprintTiles", () => {
	it("covers the base row across the prop width", () => {
		const tiles = keySet(groundFootprintTiles(210, 260, 250));
		expect(tiles).toEqual(new Set(["1,4", "2,4", "3,4", "4,4", "5,4"]));
	});

	it("ignores height so canopies never block", () => {
		const tiles = keySet(groundFootprintTiles(500, 165, 122));
		expect(tiles).toEqual(new Set(["6,2", "7,2", "8,2"]));
	});
});

describe("decorByTile", () => {
	it("does not treat shovel-movable flowers as disposable decor", () => {
		const decor = decorByTile(props);
		expect(decor.size).toBe(0);
	});

	it("ignores blocking props", () => {
		const decor = decorByTile(props);
		for (const indices of decor.values()) {
			for (const index of indices) {
				expect(propBlocking[props[index].asset]).toBe("none");
			}
		}
	});

	it("ignores blocking props even when they share a tile", () => {
		const decor = decorByTile([
			{ asset: "daisies", x: 10, y: 10, width: 52 },
			{ asset: "marigolds", x: 20, y: 20, width: 52 },
			{ asset: "well", x: 500, y: 500, width: 96 },
		]);
		expect(decor.size).toBe(0);
	});
});

describe("BlockRegistry", () => {
	it("blocks added tiles and unblocks on remove", () => {
		const blocks = new BlockRegistry();
		expect(blocks.isBlocked(7, 5)).toBe(false);
		blocks.add("rail", [
			{ column: 6, row: 5 },
			{ column: 7, row: 5 },
		]);
		expect(blocks.isBlocked(7, 5)).toBe(true);
		blocks.remove("rail");
		expect(blocks.isBlocked(7, 5)).toBe(false);
	});

	it("keeps tiles covered by overlapping entries", () => {
		const blocks = new BlockRegistry();
		blocks.add("a", [{ column: 9, row: 9 }]);
		blocks.add("b", [{ column: 9, row: 9 }]);
		blocks.remove("a");
		expect(blocks.isBlocked(9, 9)).toBe(true);
		blocks.remove("b");
		expect(blocks.isBlocked(9, 9)).toBe(false);
	});

	it("re-adding an id replaces its tiles", () => {
		const blocks = new BlockRegistry();
		blocks.add("fence", [{ column: 1, row: 1 }]);
		blocks.add("fence", [{ column: 2, row: 2 }]);
		expect(blocks.isBlocked(1, 1)).toBe(false);
		expect(blocks.isBlocked(2, 2)).toBe(true);
	});
});

describe("initial prop blocking", () => {
	function seedRegistry(): BlockRegistry {
		const blocks = new BlockRegistry();
		props.forEach((prop, index) => {
			const rule = propBlocking[prop.asset];
			if (rule === "rect") {
				const aspect = ASPECTS[prop.asset] ?? 1;
				blocks.add(
					`prop-${index}`,
					rectFootprintTiles(prop.x, prop.y, prop.width, prop.width * aspect),
				);
			} else if (rule === "base") {
				blocks.add(
					`prop-${index}`,
					groundFootprintTiles(prop.x, prop.y, prop.width),
				);
			}
		});
		blocks.add("field-fence", fenceBlockedTiles([]));
		return blocks;
	}

	it("starts without fence-blocked tiles, then blocks placed posts", () => {
		const blocks = seedRegistry();
		expect(blocks.isBlocked(8, 7)).toBe(false);
		blocks.add("field-fence", fenceBlockedTiles([{ x: 8, y: 7 }]));
		expect(blocks.isBlocked(8, 7)).toBe(true);
		blocks.add("field-fence", fenceBlockedTiles([]));
		expect(blocks.isBlocked(8, 7)).toBe(false);
	});

	it("blocks building, tree, and furniture bases", () => {
		const blocks = seedRegistry();
		expect(blocks.isBlocked(3, 4)).toBe(true);
		expect(blocks.isBlocked(14, 4)).toBe(true);
		expect(blocks.isBlocked(2, 6)).toBe(true);
		expect(blocks.isBlocked(13, 9)).toBe(true);
		expect(blocks.isBlocked(7, 2)).toBe(true);
		expect(blocks.isBlocked(16, 9)).toBe(true);
	});

	it("blocks tiles behind tall structures", () => {
		const blocks = seedRegistry();
		expect(blocks.isBlocked(3, 1)).toBe(true);
		expect(blocks.isBlocked(14, 1)).toBe(true);
		expect(blocks.isBlocked(2, 5)).toBe(true);
		expect(blocks.isBlocked(13, 8)).toBe(true);
		expect(blocks.isBlocked(5, 5)).toBe(true);
		expect(blocks.isBlocked(12, 5)).toBe(true);
	});

	it("leaves tree shade plantable", () => {
		const blocks = seedRegistry();
		expect(blocks.isBlocked(7, 1)).toBe(false);
		expect(blocks.isBlocked(10, 1)).toBe(false);
		expect(blocks.isBlocked(10, 0)).toBe(false);
	});

	it("blocks movable flowers until shoveled, leaving the field open", () => {
		const blocks = seedRegistry();
		expect(blocks.isBlocked(11, 3)).toBe(true);
		expect(blocks.isBlocked(2, 7)).toBe(true);
		for (const row of [6, 7]) {
			for (let column = 7; column <= 10; column += 1) {
				expect(blocks.isBlocked(column, row)).toBe(false);
			}
		}
	});
});
