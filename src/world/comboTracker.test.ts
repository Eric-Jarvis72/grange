import { describe, expect, it } from "vitest";
import {
	COMBO_SWAP_GRACE_MS,
	COMBO_WINDOW_MS,
} from "../../shared/mechanics";
import { ComboTracker } from "./comboTracker";

describe("ComboTracker", () => {
	it("increments on valid actions and expires after the window", () => {
		const combo = new ComboTracker();
		expect(combo.register("till", 0)).toBe(1);
		expect(combo.register("plant", 100)).toBe(2);
		expect(combo.update(100 + COMBO_WINDOW_MS - 1)).toBe(2);
		expect(combo.update(100 + COMBO_WINDOW_MS + 1)).toBe(0);
	});

	it("grants the swap grace once, only across different actions", () => {
		const combo = new ComboTracker();
		combo.register("harvest", 0);
		combo.noteHotbarSwap();
		combo.register("plant", 100);
		expect(combo.expiresAtMs).toBe(100 + COMBO_WINDOW_MS + COMBO_SWAP_GRACE_MS);

		combo.noteHotbarSwap();
		combo.register("plant", 200);
		expect(combo.expiresAtMs).toBe(200 + COMBO_WINDOW_MS);
	});

	it("does not grant grace on the very first action", () => {
		const combo = new ComboTracker();
		combo.noteHotbarSwap();
		combo.register("till", 0);
		expect(combo.expiresAtMs).toBe(COMBO_WINDOW_MS);
	});

	it("adds flat bonuses and refreshes the window", () => {
		const combo = new ComboTracker();
		combo.register("harvest", 0);
		expect(combo.add(3, 100)).toBe(4);
	});

	it("exposes tiered perks without coin inflation", () => {
		const combo = new ComboTracker();
		for (let i = 0; i < 5; i += 1) combo.register("till", 0);
		expect(combo.perks().moveSpeed).toBeCloseTo(1.1);
		expect(combo.perks().spreadChance).toBe(0);

		for (let i = 0; i < 5; i += 1) combo.register("till", 0);
		expect(combo.perks().spreadChance).toBeCloseTo(0.15);

		for (let i = 0; i < 5; i += 1) combo.register("till", 0);
		expect(combo.perks().tier).toBe("mutation");
		expect(combo.perks().mutationMultiplier).toBeCloseTo(1.5);
	});
});
