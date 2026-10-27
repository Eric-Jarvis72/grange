import { describe, expect, it } from "vitest";
import {
	facingFor,
	frameSourceViews,
	idleDuration,
	nearestWithin,
	pickWanderTarget,
	type WanderBounds,
} from "./horseLogic";

const bounds: WanderBounds = { left: 0, right: 100, top: 0, bottom: 100 };

/** Deterministic pseudo-random so the wander tests are reproducible. */
function seededRandom(seed: number): () => number {
	let state = seed;
	return () => {
		state = (state * 1_103_515_245 + 12_345) % 2_147_483_648;
		return state / 2_147_483_648;
	};
}

describe("facingFor", () => {
	it("flips with horizontal travel and holds the last facing when vertical", () => {
		expect(facingFor("right", -5)).toBe("left");
		expect(facingFor("left", 5)).toBe("right");
		expect(facingFor("left", 0)).toBe("left");
		expect(facingFor("right", 0)).toBe("right");
	});
});

describe("pickWanderTarget", () => {
	it("always lands inside the bounds and within the roam radius", () => {
		const random = seededRandom(7);
		const home = { x: 50, y: 50 };
		for (let attempt = 0; attempt < 500; attempt += 1) {
			const target = pickWanderTarget(home, 40, bounds, random);
			expect(target.x).toBeGreaterThanOrEqual(bounds.left);
			expect(target.x).toBeLessThanOrEqual(bounds.right);
			expect(target.y).toBeGreaterThanOrEqual(bounds.top);
			expect(target.y).toBeLessThanOrEqual(bounds.bottom);
			expect(Math.hypot(target.x - home.x, target.y - home.y)).toBeLessThanOrEqual(
				40 + 1e-9,
			);
		}
	});

	it("clamps targets that would fall outside the bounds", () => {
		const target = pickWanderTarget({ x: 2, y: 2 }, 100, bounds, seededRandom(1));
		expect(target.x).toBeGreaterThanOrEqual(0);
		expect(target.y).toBeGreaterThanOrEqual(0);
	});
});

describe("idleDuration", () => {
	it("stays within the documented range", () => {
		const random = seededRandom(42);
		for (let attempt = 0; attempt < 200; attempt += 1) {
			const duration = idleDuration(random);
			expect(duration).toBeGreaterThanOrEqual(900);
			expect(duration).toBeLessThanOrEqual(3_200);
		}
	});
});

describe("nearestWithin", () => {
	it("finds the closest point inside range and ignores distant ones", () => {
		const points = [
			{ x: 0, y: 0 },
			{ x: 30, y: 40 },
			{ x: 200, y: 200 },
		];
		expect(nearestWithin({ x: 5, y: 0 }, points, 70)).toBe(0);
		expect(nearestWithin({ x: 35, y: 40 }, points, 70)).toBe(1);
		expect(nearestWithin({ x: 100, y: 100 }, points, 70)).toBe(-1);
	});

	it("returns -1 for an empty list", () => {
		expect(nearestWithin({ x: 0, y: 0 }, [], 100)).toBe(-1);
	});
});

describe("frameSourceViews", () => {
	it("tiles the full width with no gaps or overlaps", () => {
		const views = frameSourceViews(2634, 587, 4);
		expect(views).toHaveLength(4);
		expect(views[0].x).toBe(0);
		let expectedLeft = 0;
		for (const view of views) {
			expect(view.x).toBe(expectedLeft);
			expect(view.y).toBe(0);
			expect(view.height).toBe(587);
			expectedLeft = view.x + view.width;
		}
		expect(expectedLeft).toBe(2634);
	});

	it("handles widths that do not divide evenly", () => {
		const views = frameSourceViews(1886, 1640, 4);
		const total = views.reduce((sum, view) => sum + view.width, 0);
		expect(total).toBe(1886);
	});
});
