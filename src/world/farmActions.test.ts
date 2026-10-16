import { describe, expect, it, vi } from "vitest";
import {
	activeFarmSynergy,
	maybeSpread,
	resolveAction,
	rollMutation,
	spreadTarget,
} from "./farmActions";

describe("resolveAction", () => {
	it("tills bare grass and rejects tilled ground", () => {
		expect(resolveAction("hoe", undefined, true)).toEqual({
			ok: true,
			plan: { kind: "till", tool: "hand" },
		});
		expect(resolveAction("hoe", { state: "tilled" }, true).ok).toBe(false);
	});

	it("requires a scythe for scythe-only crops", () => {
		const wheat = { state: "ready" as const, crop: "wheat" };
		const hand = resolveAction("hoe", wheat, true);
		expect(hand.ok).toBe(false);
		if (!hand.ok) expect(hand.shake).toBe(true);
		expect(resolveAction("scythe", wheat, true)).toEqual({
			ok: true,
			plan: { kind: "harvest", tool: "scythe" },
		});
	});

	it("hand-harvests softer crops when clicked without a scythe", () => {
		const tomato = { state: "ready" as const, crop: "tomato" };
		expect(resolveAction("bucket", tomato, true)).toEqual({
			ok: true,
			plan: { kind: "harvest", tool: "hand" },
		});
	});
});

describe("spreadTarget", () => {
	const tiles = [
		{ x: 2, y: 1, state: "planted" as const, crop: "tomato" },
		{ x: 1, y: 2, state: "ready" as const, crop: "tomato" },
	];

	it("picks an eligible neighbour by action type", () => {
		expect(spreadTarget(tiles, 2, 2, "water", () => 0)).toEqual({ x: 2, y: 1 });
		expect(spreadTarget(tiles, 2, 2, "harvest", () => 0)).toEqual({ x: 1, y: 2 });
	});

	it("returns null when no neighbour qualifies", () => {
		expect(spreadTarget(tiles, 10, 10, "water", () => 0)).toBeNull();
	});
});

describe("maybeSpread", () => {
	const tiles = [{ x: 2, y: 1, state: "planted" as const, crop: "tomato" }];

	it("emits one spread action when the roll passes", () => {
		const emit = vi.fn();
		maybeSpread(10, tiles, 2, 2, "water", "hand", emit, () => 0);
		expect(emit).toHaveBeenCalledWith(2, 1, "hand");
	});

	it("does nothing when the roll fails", () => {
		const emit = vi.fn();
		maybeSpread(10, tiles, 2, 2, "water", "hand", emit, () => 0.9);
		expect(emit).not.toHaveBeenCalled();
	});
});

describe("synergy and mutation", () => {
	it("detects tomato companion synergy with no crowding", () => {
		const tile = { x: 2, y: 2, state: "ready" as const, crop: "tomato" };
		expect(activeFarmSynergy(tile, [tile, { x: 2, y: 1, state: "ready", crop: "lettuce" }])).toBe(
			true,
		);
		expect(activeFarmSynergy(tile, [tile, { x: 2, y: 1, state: "ready", crop: "tomato" }])).toBe(
			false,
		);
	});

	it("rolls mutation seeds only for standard crops", () => {
		expect(rollMutation("lettuce", 15, true, () => 0)).toBe("frost-lettuce-seed");
		expect(rollMutation("midas_wheat", 15, true, () => 0)).toBeNull();
		expect(rollMutation("lettuce", 0, false, () => 0.9)).toBeNull();
	});
});
