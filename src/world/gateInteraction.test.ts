import { describe, expect, it } from "vitest";
import type { FenceGate } from "../../shared/types";
import { nearbyGate } from "./gateInteraction";

const gate = (x: number, y: number, open: boolean): FenceGate => ({
	x,
	y,
	direction: "horizontal",
	open,
});

describe("gate interaction", () => {
	it("offers the open prompt for a closed gate in range", () => {
		const nearby = nearbyGate([gate(4, 4, false)], { x: 256, y: 288 });
		expect(nearby?.gate).toMatchObject({ x: 4, y: 4 });
		expect(nearby?.prompt).toBe("Press E or Enter to open gate");
	});

	it("offers the close prompt once the gate is open", () => {
		const nearby = nearbyGate([gate(4, 4, true)], { x: 256, y: 288 });
		expect(nearby?.prompt).toBe("Press E or Enter to close gate");
	});

	it("ignores gates outside the interaction radius and picks the closest", () => {
		expect(nearbyGate([gate(4, 4, false)], { x: 0, y: 0 })).toBeNull();
		const nearby = nearbyGate(
			[gate(4, 4, false), gate(5, 4, true)],
			{ x: 340, y: 288 },
		);
		expect(nearby?.gate).toMatchObject({ x: 5, y: 4 });
	});
});
