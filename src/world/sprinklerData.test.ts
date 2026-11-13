import { describe, expect, it } from "vitest";
import type { ActiveFarm } from "../../shared/types";
import { sprinklerPlacementReason, sprinklerNear } from "./sprinklerActions";
import {
	sprinklerAnchorAt,
	sprinklerCorner,
	sprinklerCovers,
	sprinklerInBounds,
} from "./sprinklerData";

function farm(overrides: Partial<ActiveFarm> = {}): ActiveFarm {
	return {
		owner: "tester",
		tiles: [],
		tomatoes: 0,
		barn: {},
		storage: {},
		animals: {},
		land_level: 4,
		is_public: false,
		visitor_edit: false,
		fences: [],
		fence_count: 0,
		gates: [],
		gate_count: 0,
		sprinklers: [],
		sprinkler_count: 1,
		prop_overrides: [],
		prop_inventory: {},
		...overrides,
	};
}

describe("sprinkler coordinates", () => {
	it("anchors a sprinkler on the corner shared by its four tiles", () => {
		expect(sprinklerCorner(0, 0)).toEqual({ x: 64, y: 64 });
		expect(sprinklerCorner(7, 6)).toEqual({ x: 512, y: 448 });
	});

	it("snaps a world position to the nearest corner's anchor tile", () => {
		expect(sprinklerAnchorAt(100, 100)).toEqual({ x: 1, y: 1 });
		expect(sprinklerAnchorAt(512, 448)).toEqual({ x: 7, y: 6 });
	});

	it("covers exactly its 2x2 square", () => {
		expect(sprinklerCovers(1, 1, 1, 1)).toBe(true);
		expect(sprinklerCovers(1, 1, 2, 2)).toBe(true);
		expect(sprinklerCovers(1, 1, 3, 1)).toBe(false);
		expect(sprinklerCovers(1, 1, 1, 3)).toBe(false);
	});

	it("requires both covered tiles to be on the map", () => {
		expect(sprinklerInBounds(18, 8)).toBe(true);
		expect(sprinklerInBounds(19, 8)).toBe(false);
		expect(sprinklerInBounds(18, 9)).toBe(false);
	});
});

describe("sprinkler placement", () => {
	it("allows clear owned land with supply", () => {
		expect(sprinklerPlacementReason(farm(), 7, 6)).toBeNull();
	});

	it("rejects a spot without supply", () => {
		expect(sprinklerPlacementReason(farm({ sprinkler_count: 0 }), 7, 6)).toBe(
			"No sprinklers in inventory.",
		);
	});

	it("rejects a corner that already has a sprinkler", () => {
		expect(
			sprinklerPlacementReason(farm({ sprinklers: [{ x: 7, y: 6 }] }), 7, 6),
		).toBe("A sprinkler already sits here.");
	});

	it("can sit on tilled or planted soil without blocking it", () => {
		const worked = farm({
			tiles: [
				{ x: 7, y: 6, state: "tilled", crop: "tomato" },
				{ x: 8, y: 6, state: "planted", crop: "tomato" },
				{ x: 7, y: 7, state: "watered", crop: "wheat" },
				{ x: 8, y: 7, state: "ready", crop: "tomato" },
			],
		});
		expect(sprinklerPlacementReason(worked, 7, 6)).toBeNull();
	});

	it("rejects land the player does not own", () => {
		expect(sprinklerPlacementReason(farm({ land_level: 0 }), 18, 6)).toBe(
			"Buy this land from the mayor first.",
		);
	});
});

describe("sprinklerNear", () => {
	it("finds the sprinkler whose corner is closest within reach", () => {
		const f = farm({
			sprinklers: [
				{ x: 0, y: 0 },
				{ x: 4, y: 4 },
			],
		});
		expect(sprinklerNear(f, 70, 70)?.x).toBe(0);
		expect(sprinklerNear(f, 330, 330)?.x).toBe(4);
		expect(sprinklerNear(f, 900, 700)).toBeNull();
	});
});
