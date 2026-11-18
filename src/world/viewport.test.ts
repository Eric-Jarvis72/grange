import { describe, expect, it } from "vitest";
import { cameraAxis } from "./viewport";

describe("viewport camera", () => {
	it("centres the camera when the view is wider than the world", () => {
		expect(cameraAxis(100, 700, 0, 1152)).toBe(576);
	});

	it("clamps the camera to the world when it can pan", () => {
		// Market world is 2048 wide; a 1365-wide view can pan between these.
		expect(cameraAxis(0, 682.5, 0, 2048)).toBeCloseTo(682.5);
		expect(cameraAxis(3000, 682.5, 0, 2048)).toBeCloseTo(1365.5);
	});

	it("follows the player between the clamped camera limits", () => {
		expect(cameraAxis(700, 682.5, 0, 2048)).toBe(700);
	});
});
