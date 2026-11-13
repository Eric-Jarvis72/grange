import { describe, expect, it } from "vitest";
import { mayMoveProps } from "./farmPropActions";
import { footprintTileSpan, propPlacementReason, snapPropAnchor } from "./propPlacement";
import { farmPlacementFootprints } from "./sceneObstacles";
import { propObstacles } from "./walkCollisions";

describe("prop placement", () => {
	it("snaps the visible preview and submitted anchor to the same 2px grid", () => {
		expect(snapPropAnchor(211, 261)).toEqual({ x: 212, y: 262 });
	});

	it("allows the ground footprint to sit on a road path", () => {
		const placement = { x: 288, y: 290, width: 250, height: 245,
			ground: { left: 175.5, right: 400.5, top: 160, bottom: 290 } };
		expect(propPlacementReason(placement, [], [], { x: 576, y: 620 })).toBeNull();
		expect(footprintTileSpan(placement.ground)).toEqual({ columns: 5, rows: 3 });
	});

	it("blocks only actual ground overlap, not nearby artwork", () => {
		const placement = { x: 288, y: 450, width: 250, height: 245,
			ground: { left: 175.5, right: 400.5, top: 320, bottom: 450 } };
		const nearby = { left: 402, right: 450, top: 340, bottom: 400 };
		const overlap = { left: 400, right: 450, top: 340, bottom: 400 };
		expect(propPlacementReason(placement, [nearby], [], { x: 576, y: 620 })).toBeNull();
		expect(propPlacementReason(placement, [overlap], [], { x: 576, y: 620 }))
			.toMatch(/Another object/);
	});

	it("permits shoreline edge but not water or a tilled tile", () => {
		const placement = { x: 300, y: 704, width: 96, height: 100,
			ground: { left: 264, right: 336, top: 650, bottom: 704 } };
		expect(propPlacementReason(placement, [], [], { x: 576, y: 620 })).toBeNull();
		expect(propPlacementReason({ ...placement, y: 706,
			ground: { ...placement.ground, bottom: 706 } }, [], [], { x: 576, y: 620 }))
			.toMatch(/water/);
		expect(propPlacementReason(placement, [], [{ x: 4, y: 10, state: "tilled", crop: "tomato" }],
			{ x: 576, y: 620 })).toMatch(/crop or tilled/);
	});

	it("gives every flower a small placement footprint", () => {
		for (const asset of ["daisies", "marigolds", "blue-flowers"] as const) {
			expect(propObstacles([{ asset, x: 400, y: 400, width: 50 }],
				farmPlacementFootprints)).toEqual([
				{ left: 393.75, right: 406.25, top: 382, bottom: 400 },
				]);
		}
	});
});

describe("prop permissions", () => {
	it("lets owners and admins rearrange props", () => {
		expect(mayMoveProps(true, false)).toBe(true);
		expect(mayMoveProps(false, true)).toBe(true);
		expect(mayMoveProps(true, true)).toBe(true);
	});

	it("keeps non-admin visitors read-only", () => {
		expect(mayMoveProps(false, false)).toBe(false);
	});
});
