import { describe, expect, it } from "vitest";
import { atUnownedLandBorder } from "./landBorder";

describe("unowned farm border hint", () => {
	it("fires when pressing into an unpurchased side or top edge", () => {
		expect(atUnownedLandBorder({ x: -1, y: 0 }, { x: 16, y: 400 }, 0)).toBe(
			true,
		);
		expect(atUnownedLandBorder({ x: 1, y: 0 }, { x: 1136, y: 400 }, 0)).toBe(
			true,
		);
		expect(atUnownedLandBorder({ x: 0, y: -1 }, { x: 400, y: 32 }, 0)).toBe(
			true,
		);
	});

	it("does not fire one pixel inside the owned edge", () => {
		expect(atUnownedLandBorder({ x: -1, y: 0 }, { x: 18, y: 400 }, 0)).toBe(
			false,
		);
		expect(atUnownedLandBorder({ x: 0, y: -1 }, { x: 400, y: 34 }, 0)).toBe(
			false,
		);
	});

	it("tracks the current land tier", () => {
		expect(atUnownedLandBorder({ x: -1, y: 0 }, { x: -112, y: 400 }, 2)).toBe(
			true,
		);
		expect(atUnownedLandBorder({ x: -1, y: 0 }, { x: -110, y: 400 }, 2)).toBe(
			false,
		);
	});

	it("stops firing once the final parcel owns the whole border", () => {
		expect(atUnownedLandBorder({ x: -1, y: 0 }, { x: -368, y: 400 }, 5)).toBe(
			false,
		);
		expect(atUnownedLandBorder({ x: 1, y: 0 }, { x: 1584, y: 400 }, 5)).toBe(
			false,
		);
		expect(atUnownedLandBorder({ x: 0, y: -1 }, { x: 400, y: -224 }, 5)).toBe(
			false,
		);
	});

	it("never treats the southern river as purchasable land", () => {
		expect(atUnownedLandBorder({ x: 0, y: 1 }, { x: 400, y: 752 }, 0)).toBe(
			false,
		);
	});
});
