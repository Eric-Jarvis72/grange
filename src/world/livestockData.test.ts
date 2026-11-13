import { describe, expect, it } from "vitest";
import { livestockPens, livestockWalkObstacles } from "./livestockData";

describe("livestock market layout", () => {
	it("has a priced pen for every prepared animal sprite", () => {
		expect(livestockPens.map((pen) => pen.id)).toEqual(["cow", "hen", "sheep", "pig"]);
		for (const pen of livestockPens) {
			expect(pen.price).toBeGreaterThan(0);
			expect(pen.width).toBeGreaterThan(0);
		}
	});

	it("keeps the center aisle outside every solid pen", () => {
		for (const obstacle of livestockWalkObstacles.slice(4)) {
			expect(obstacle.left > 575 || obstacle.right < 577).toBe(true);
		}
	});
});
