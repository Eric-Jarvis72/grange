import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ActiveFarm } from "../../shared/types";
import { countItem, useInventoryStore } from "../inventory/inventoryStore";
import { useGameStore } from "../store";
import { ComboController } from "./farmCombo";
import { performFarmAction } from "./farmActionRunner";
import type { SweepFx } from "./sweepFx";

vi.mock("../socket", () => ({ emitFarmAction: vi.fn() }));

import { emitFarmAction } from "../socket";

const emit = vi.mocked(emitFarmAction);

function farmWithTile(state: ActiveFarm["tiles"][number]["state"]): ActiveFarm {
	return {
		owner: "tester",
		tiles: [
			{ x: 0, y: 0, state, crop: state === "tilled" ? undefined : "tomato" },
		],
		tomatoes: 0,
		barn: {},
		animals: {},
		fences: [],
		fence_count: 0,
		gates: [],
		gate_count: 0,
		prop_overrides: [],
		prop_inventory: {},
	};
}

function act(): void {
	performFarmAction(
		"tester",
		new ComboController(),
		{ play: vi.fn() } as unknown as SweepFx,
		0,
		0,
		{
			message: vi.fn(),
			shake: vi.fn(),
		},
	);
}

beforeEach(() => {
	vi.clearAllMocks();
	useInventoryStore.getState().resetInventory();
});

describe("performFarmAction uses the held hotbar item, not the slot position", () => {
	it("plants when a seed is moved into the watering can's slot", () => {
		const store = useInventoryStore.getState();
		store.moveStack({ area: "hotbar", index: 1 }, { area: "hotbar", index: 2 });
		store.selectHotbar(2);
		expect(useInventoryStore.getState().hotbar[2]?.itemId).toBe("seed-bag");
		useGameStore.getState().setActiveFarm(farmWithTile("tilled"));

		act();

		expect(emit).toHaveBeenCalledWith(
			"tester",
			expect.objectContaining({ kind: "plant", crop: "tomato" }),
			expect.any(Function),
		);
		expect(countItem(useInventoryStore.getState(), "seed-bag")).toBe(10);
	});

	it("takes seed counts from the server's action ack", () => {
		const store = useInventoryStore.getState();
		store.moveStack({ area: "hotbar", index: 1 }, { area: "hotbar", index: 2 });
		store.selectHotbar(2);
		useGameStore.getState().setActiveFarm(farmWithTile("tilled"));

		act();

		const ack = emit.mock.calls[0]?.[2] as (res: {
			ok: boolean;
			seeds?: Record<string, number>;
		}) => void;
		ack({ ok: true, seeds: { "seed-bag": 9 } });
		expect(countItem(useInventoryStore.getState(), "seed-bag")).toBe(9);
	});

	it("resyncs seeds when the server rejects the action", () => {
		const store = useInventoryStore.getState();
		store.moveStack({ area: "hotbar", index: 1 }, { area: "hotbar", index: 2 });
		store.selectHotbar(2);
		useGameStore.getState().setActiveFarm(farmWithTile("tilled"));
		const feedback = { message: vi.fn(), shake: vi.fn() };

		performFarmAction(
			"tester",
			new ComboController(),
			{ play: vi.fn() } as unknown as SweepFx,
			0,
			0,
			feedback,
		);

		const ack = emit.mock.calls[0]?.[2] as (res: {
			ok: boolean;
			error?: string;
			seeds?: Record<string, number>;
		}) => void;
		ack({ ok: false, error: "no seeds", seeds: { "seed-bag": 0 } });
		expect(countItem(useInventoryStore.getState(), "seed-bag")).toBe(0);
		expect(feedback.message).toHaveBeenCalledWith("no seeds");
	});

	it("waters only when the watering can is actually held", () => {
		const store = useInventoryStore.getState();
		store.moveStack({ area: "hotbar", index: 2 }, { area: "hotbar", index: 7 });
		store.selectHotbar(7);
		expect(useInventoryStore.getState().hotbar[7]?.itemId).toBe("watering-can");
		useGameStore.getState().setActiveFarm(farmWithTile("planted"));

		act();

		expect(emit).toHaveBeenCalledWith(
			"tester",
			expect.objectContaining({ kind: "water" }),
			expect.any(Function),
		);
	});

	it("does nothing when the held slot has no tool item", () => {
		const store = useInventoryStore.getState();
		store.selectHotbar(9);
		useGameStore.getState().setActiveFarm(farmWithTile("planted"));
		const feedback = { message: vi.fn(), shake: vi.fn() };

		performFarmAction(
			"tester",
			new ComboController(),
			{ play: vi.fn() } as unknown as SweepFx,
			0,
			0,
			feedback,
		);

		expect(emit).not.toHaveBeenCalled();
		expect(feedback.message).toHaveBeenCalled();
	});
});
