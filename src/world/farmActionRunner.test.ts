import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ActiveFarm } from "../../shared/types";
import { useInventoryStore } from "../inventory/inventoryStore";
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
		tiles: [{ x: 0, y: 0, state, crop: state === "tilled" ? undefined : "tomato" }],
		tomatoes: 0,
		barn: {},
		fences: [],
		fence_count: 0,
		prop_overrides: [],
		prop_inventory: {},
	};
}

function act(): void {
	performFarmAction("tester", new ComboController(), { play: vi.fn() } as unknown as SweepFx, 0, 0, {
		message: vi.fn(),
		shake: vi.fn(),
	});
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
		);
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
