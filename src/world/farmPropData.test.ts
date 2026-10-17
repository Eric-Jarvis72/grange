import { describe, expect, it } from "vitest";
import { movablePropAt, placedFarmProps } from "./farmPropData";

describe("per-farm movable props", () => {
	it("starts with the shared props and keeps the train fixed", () => {
		expect(placedFarmProps([])).toHaveLength(17);
		expect(movablePropAt(0)).toBe("farmhouse");
		expect(movablePropAt(1)).toBe("barn");
		expect(movablePropAt(12)).toBeNull();
	});

	it("removes a carried prop and restores it at its saved position", () => {
		const carried = [{ index: 2, asset: "well", x: 0, y: 0, carried: true }];
		expect(placedFarmProps(carried).some(({ index }) => index === 2)).toBe(false);
		const moved = placedFarmProps([{ ...carried[0], x: 480, y: 416, carried: false }]);
		expect(moved.find(({ index }) => index === 2)).toMatchObject({ asset: "well", x: 480, y: 416 });
		expect(moved.find(({ index }) => index === 12)?.asset).toBe("starter-train");
	});

	it("ignores a mismatched asset override", () => {
		expect(placedFarmProps([{ index: 2, asset: "train", x: 0, y: 0, carried: true }])
			.find(({ index }) => index === 2)?.asset).toBe("well");
	});
});
