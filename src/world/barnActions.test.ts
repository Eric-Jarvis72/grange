import { describe, expect, it } from "vitest";
import { BARN_REACH, opensBarn, withinBarnReach } from "./barnActions";

describe("opensBarn", () => {
	it("opens for the owner with an empty hand or a tool", () => {
		expect(opensBarn(true, null, "barn")).toBe(true);
		expect(opensBarn(true, "hoe", "barn")).toBe(true);
	});

	it("keeps digging and prop placement in charge", () => {
		expect(opensBarn(true, "shovel", "barn")).toBe(false);
		expect(opensBarn(true, "crate", "barn")).toBe(false);
	});

	it("ignores visitors and props that are not the barn", () => {
		expect(opensBarn(false, null, "barn")).toBe(false);
		expect(opensBarn(true, null, "well")).toBe(false);
		expect(opensBarn(true, null, undefined)).toBe(false);
	});
});

describe("withinBarnReach", () => {
	// A 200x160 barn whose base sits at (500, 400).
	const barn = { x: 500, y: 400, width: 200, height: 160 };

	it("reaches the player standing at the barn's base", () => {
		expect(withinBarnReach({ x: 500, y: 400 }, barn)).toBe(true);
		expect(withinBarnReach({ x: 500, y: 440 }, barn)).toBe(true);
	});

	it("reaches the player standing beside a wall", () => {
		expect(withinBarnReach({ x: 380, y: 380 }, barn)).toBe(true);
		expect(withinBarnReach({ x: 620, y: 380 }, barn)).toBe(true);
	});

	it("ignores a player across the map", () => {
		expect(withinBarnReach({ x: 500, y: 400 + BARN_REACH + 1 }, barn)).toBe(
			false,
		);
		expect(withinBarnReach({ x: 380 - BARN_REACH - 1, y: 380 }, barn)).toBe(
			false,
		);
		expect(withinBarnReach({ x: 500, y: 400 - 160 - BARN_REACH - 1 }, barn)).toBe(
			false,
		);
	});

	it("honours a custom margin", () => {
		expect(withinBarnReach({ x: 500, y: 500 }, barn, 200)).toBe(true);
		expect(withinBarnReach({ x: 500, y: 500 }, barn, 10)).toBe(false);
	});
});
