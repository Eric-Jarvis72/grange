import { describe, expect, it } from "vitest";
import { nearestPropPlacement } from "./farmPropActions";
import { farmPlacementFootprints } from "./sceneObstacles";
import { propObstacles } from "./walkCollisions";

describe("prop placement", () => {
	it("keeps an exact legal position, including the original farmhouse anchor", () => {
		expect(nearestPropPlacement(210, 260, (x, y) => x === 210 && y === 260))
			.toEqual({ x: 210, y: 260 });
	});

	it("moves a bottom-anchored house slightly forward when its click overlaps scenery", () => {
		expect(nearestPropPlacement(288, 450, (x, y) => x === 288 && y >= 530))
			.toEqual({ x: 288, y: 530 });
	});

	it("does not move an item beyond the nearby search area", () => {
		expect(nearestPropPlacement(288, 450, (_x, y) => y >= 594)).toBeNull();
	});

	it("gives every flower a small placement footprint", () => {
		for (const asset of ["daisies", "marigolds", "blue-flowers"] as const) {
			expect(propObstacles([{ asset, x: 400, y: 400, width: 50 }],
				farmPlacementFootprints)).toEqual([
					{ left: 382.5, right: 417.5, top: 382, bottom: 400 },
				]);
		}
	});
});
