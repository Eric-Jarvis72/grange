import { describe, expect, it } from "vitest";
import { depthForY } from "./depth";

describe("depthForY", () => {
	it("puts actors in the same band as props", () => {
		expect(depthForY(0)).toBe(100);
		expect(depthForY(260)).toBe(360);
		expect(depthForY(619.9)).toBe(719);
	});

	it("draws a player below a prop in front of it", () => {
		// The farmhouse stands at y = 260; a player at y = 300 is below it.
		expect(depthForY(300)).toBeGreaterThan(depthForY(260));
	});

	it("draws a player above a prop behind it", () => {
		expect(depthForY(200)).toBeLessThan(depthForY(260));
	});
});
