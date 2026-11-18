import { describe, expect, it } from "vitest";
import { FrameClock, MAX_FRAME_STEP_MS } from "./frameClock";

describe("FrameClock", () => {
	it("reports the real elapsed time for normal frames", () => {
		const clock = new FrameClock(1_000);
		expect(clock.step(1_016)).toBe(16);
		expect(clock.step(1_033)).toBe(17);
	});

	it("caps a starved frame instead of losing it", () => {
		const clock = new FrameClock(0);
		expect(clock.step(500)).toBe(MAX_FRAME_STEP_MS);
		expect(clock.step(1_000)).toBe(MAX_FRAME_STEP_MS);
	});

	it("never returns a negative step", () => {
		const clock = new FrameClock(2_000);
		expect(clock.step(1_500)).toBe(0);
		expect(clock.step(2_010)).toBe(10);
	});

	it("ignores non-finite timestamps", () => {
		const clock = new FrameClock(0);
		expect(clock.step(Number.NaN)).toBe(0);
		expect(clock.step(Number.POSITIVE_INFINITY)).toBe(0);
		expect(clock.step(16)).toBe(16);
	});

	it("drops the backlog on reset", () => {
		const clock = new FrameClock(0);
		clock.reset(10_000);
		expect(clock.step(10_016)).toBe(16);
	});
});
