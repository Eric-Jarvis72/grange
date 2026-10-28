import { describe, expect, it, vi } from "vitest";
import { FISH } from "./fishingData";
import {
	applyArrow,
	type ArrowDir,
	comboLuck,
	comboLuckGain,
	COMBO_LENGTH,
	dirForKey,
	type FishingBank,
	fishWeight,
	newComboProgress,
	nextSequence,
	phishingBounty,
	pickRival,
	resolveCatch,
	rodLuck,
	rollCatch,
} from "./fishingGame";

function bank(overrides: Partial<FishingBank> = {}): FishingBank {
	return {
		deposit: overrides.deposit ?? (() => {}),
		clearDebt: overrides.clearDebt ?? (() => 0),
	};
}

describe("fishing game", () => {
	it("reads the equipped rod's luck, defaulting to zero", () => {
		expect(rodLuck("bamboo")).toBe(0);
		expect(rodLuck("master")).toBe(3);
		expect(rodLuck("missing" as never)).toBe(0);
	});

	it("makes luck help rarer fish more than common ones", () => {
		const common = fishWeight(FISH.minnow, 3) / fishWeight(FISH.minnow, 0);
		const rare = fishWeight(FISH.trout, 3) / fishWeight(FISH.trout, 0);
		expect(rare).toBeGreaterThan(common);
	});

	it("raises legendary odds as luck rises", () => {
		function legendaryShare(luck: number): number {
			const total = Object.values(FISH).reduce(
				(sum, fish) => sum + fishWeight(fish, luck),
				0,
			);
			const legendary =
				fishWeight(FISH.phishing, luck) +
				fishWeight(FISH["loan-sharks-brother"], luck);
			return legendary / total;
		}
		expect(legendaryShare(3)).toBeGreaterThan(legendaryShare(0));
	});

	it("returns the first fish at roll zero and the last near one", () => {
		expect(rollCatch(0, () => 0).id).toBe("minnow");
		expect(rollCatch(0, () => 0.999999).id).toBe("loan-sharks-brother");
	});

	it("always returns a real fish whatever the rng does", () => {
		for (const value of [0, 0.25, 0.5, 0.75, 1]) {
			expect(FISH[rollCatch(2, () => value).id]).toBeTruthy();
		}
	});

	it("builds a fresh four-arrow sequence", () => {
		expect(nextSequence(() => 0)).toEqual(["up", "up", "up", "up"]);
		expect(nextSequence(() => 0.999)).toEqual(["right", "right", "right", "right"]);
		expect(nextSequence()).toHaveLength(COMBO_LENGTH);
		expect(newComboProgress(() => 0)).toEqual({
			sequence: ["up", "up", "up", "up"],
			index: 0,
			combos: 0,
		});
	});

	it("maps arrow keys and WASD to the same directions", () => {
		expect(dirForKey("ArrowUp")).toBe("up");
		expect(dirForKey("KeyW")).toBe("up");
		expect(dirForKey("KeyA")).toBe("left");
		expect(dirForKey("ArrowDown")).toBe("down");
		expect(dirForKey("KeyD")).toBe("right");
		expect(dirForKey("Space")).toBeNull();
	});

	it("scales combo luck with the rod", () => {
		expect(comboLuckGain(0)).toBeCloseTo(0.2);
		expect(comboLuckGain(3)).toBeGreaterThan(comboLuckGain(0));
		expect(comboLuck(0, 3)).toBe(0);
		expect(comboLuck(2, 1)).toBeCloseTo(2 * 0.35);
	});

	describe("applyArrow", () => {
		const sequence: ArrowDir[] = ["up", "right", "down", "left"];
		const start = { sequence, index: 0, combos: 0 };

		it("walks the sequence forward on a hit without banking a combo", () => {
			const result = applyArrow(start, "up", () => 0);
			expect(result.hit).toBe(true);
			expect(result.completed).toBe(false);
			expect(result.progress.index).toBe(1);
			expect(result.progress.combos).toBe(0);
		});

		it("banks a combo and rolls a new sequence on a full run", () => {
			let state = start;
			for (const dir of sequence) {
				state = applyArrow(state, dir, () => 0).progress;
			}
			expect(state.combos).toBe(1);
			expect(state.index).toBe(0);
			expect(state.sequence).toEqual(["up", "up", "up", "up"]);
		});

		it("rewinds on a miss without losing banked combos", () => {
			let state = start;
			for (const dir of sequence) {
				state = applyArrow(state, dir, () => 0).progress;
			}
			const missed = applyArrow(state, "left", () => 0);
			expect(missed.hit).toBe(false);
			expect(missed.completed).toBe(false);
			expect(missed.progress.index).toBe(0);
			expect(missed.progress.combos).toBe(1);
		});
	});

	it("keeps the phishing bounty within a tenth of the pool", () => {
		expect(phishingBounty(() => 0)).toBe(10);
		expect(phishingBounty(() => 0.999)).toBeLessThanOrEqual(100);
		const bounty = phishingBounty(() => 0.5);
		expect(bounty).toBeGreaterThanOrEqual(10);
		expect(bounty).toBeLessThanOrEqual(100);
	});

	it("credits a skimming when phishing is caught", () => {
		const deposit = vi.fn();
		const result = resolveCatch(
			FISH.phishing,
			bank({ deposit }),
			"Rival",
			() => 0,
		);
		expect(deposit).toHaveBeenCalledWith(10);
		expect(result.coins).toBe(10);
		expect(result.message).toContain("Rival");
		expect(result.message).toContain("$10");
	});

	it("wipes debt when the loan shark's brother surfaces", () => {
		const result = resolveCatch(
			FISH["loan-sharks-brother"],
			bank({ clearDebt: () => 42 }),
		);
		expect(result.message).toContain("$42");
		expect(result.coins).toBe(0);
	});

	it("says so when there was no debt to erase", () => {
		const result = resolveCatch(FISH["loan-sharks-brother"], bank());
		expect(result.message).toContain("no debt");
	});

	it("leaves an ordinary catch effect-free", () => {
		const deposit = vi.fn();
		const clearDebt = vi.fn(() => 0);
		const result = resolveCatch(FISH.trout, bank({ deposit, clearDebt }));
		expect(result.coins).toBe(0);
		expect(deposit).not.toHaveBeenCalled();
		expect(clearDebt).not.toHaveBeenCalled();
		expect(result.message).toContain("Trout");
	});

	describe("pickRival", () => {
		it("never blames the player", () => {
			const rival = pickRival("me", ["me", "you"], () => 0.9);
			expect(rival).toBe("you");
		});

		it("falls back to a generic rival when alone", () => {
			expect(pickRival("me", ["me"], () => 0.5)).toBe("a rival");
			expect(pickRival("me", [], () => 0.5)).toBe("a rival");
		});
	});
});
