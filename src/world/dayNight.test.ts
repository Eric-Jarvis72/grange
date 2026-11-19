import { describe, expect, it } from "vitest";
import {
	DAY_NIGHT_CYCLE_MS,
	DAY_PHASE_MS,
	type WorldTime,
	cycleTimeNow,
	dayPhaseFor,
	dayPhaseNow,
	normalizeCycleTime,
} from "../../shared/mechanics";

describe("day/night mechanics", () => {
	it("has a 36 minute cycle with 24 minutes of day", () => {
		expect(DAY_NIGHT_CYCLE_MS).toBe(36 * 60 * 1000);
		expect(DAY_PHASE_MS).toBe(24 * 60 * 1000);
	});

	it("normalizes overflowing and negative cycle times", () => {
		expect(normalizeCycleTime(DAY_NIGHT_CYCLE_MS)).toBe(0);
		expect(normalizeCycleTime(DAY_NIGHT_CYCLE_MS + 123)).toBe(123);
		expect(normalizeCycleTime(-1)).toBe(DAY_NIGHT_CYCLE_MS - 1);
	});

	it("classifies day and night", () => {
		expect(dayPhaseFor(0)).toBe("day");
		expect(dayPhaseFor(DAY_PHASE_MS - 1)).toBe("day");
		expect(dayPhaseFor(DAY_PHASE_MS)).toBe("night");
		expect(dayPhaseFor(DAY_NIGHT_CYCLE_MS - 1)).toBe("night");
	});

	it("extrapolates the clock from the last server sync", () => {
		const time: WorldTime = {
			cycle_time_ms: DAY_PHASE_MS - 1_000,
			cycle_length_ms: DAY_NIGHT_CYCLE_MS,
			day_length_ms: DAY_PHASE_MS,
			night_length_ms: DAY_NIGHT_CYCLE_MS - DAY_PHASE_MS,
			phase: "day",
			server_time_ms: 10_000,
		};

		expect(cycleTimeNow(time, 11_000)).toBe(DAY_PHASE_MS);
		expect(dayPhaseNow(time, 11_000)).toBe("night");
		expect(dayPhaseNow(time, 500)).toBe("day");
	});
});
