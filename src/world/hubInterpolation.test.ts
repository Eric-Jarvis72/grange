import { describe, expect, it } from "vitest";
import { remoteDirection, remoteStep, shouldSnap } from "./hubInterpolation";

describe("remoteStep", () => {
	it("eases partway toward the target in one step", () => {
		const next = remoteStep({ x: 0, y: 0 }, { x: 100, y: 0 }, 100);
		expect(next.x).toBeGreaterThan(0);
		expect(next.x).toBeLessThan(100);
	});

	it("is frame-rate independent", () => {
		const twoHalfSteps = remoteStep(
			remoteStep({ x: 0, y: 0 }, { x: 100, y: 0 }, 50),
			{ x: 100, y: 0 },
			50,
		);
		const oneStep = remoteStep({ x: 0, y: 0 }, { x: 100, y: 0 }, 100);
		expect(twoHalfSteps.x).toBeCloseTo(oneStep.x, 6);
	});

	it("converges on the target", () => {
		let point = { x: 0, y: 0 };
		for (let frame = 0; frame < 200; frame += 1) {
			point = remoteStep(point, { x: 100, y: 50 }, 16);
		}
		expect(point.x).toBeCloseTo(100, 2);
		expect(point.y).toBeCloseTo(50, 2);
	});
});

describe("shouldSnap", () => {
	it("snaps across a teleport-sized gap", () => {
		expect(shouldSnap({ x: 0, y: 0 }, { x: 400, y: 0 })).toBe(true);
	});

	it("slides for a normal walking update", () => {
		expect(shouldSnap({ x: 0, y: 0 }, { x: 60, y: 0 })).toBe(false);
	});
});

describe("remoteDirection", () => {
	it("returns signs of travel for the walk animation", () => {
		expect(remoteDirection({ x: 0, y: 0 }, { x: 2, y: -3 })).toEqual({
			x: 1,
			y: -1,
		});
	});

	it("returns idle once the avatar has settled", () => {
		expect(remoteDirection({ x: 0, y: 0 }, { x: 0.05, y: 0.05 })).toEqual({
			x: 0,
			y: 0,
		});
	});
});
