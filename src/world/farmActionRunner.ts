import type { CropId } from "../../shared/crops";
import { countItem, useInventoryStore } from "../inventory/inventoryStore";
import { cropForSeedItem, farmToolForItem, type ItemId } from "../inventory/items";
import { emitFarmAction } from "../socket";
import { useGameStore } from "../store";
import type { ComboController } from "./farmCombo";
import { type ActionPlan, maybeSpread, resolveAction } from "./farmActions";
import { isTillableTile, TILE_SIZE } from "./mapData";
import type { SweepFx } from "./sweepFx";

/** Scene callbacks so the runner stays free of Excalibur specifics. */
export interface ActionFeedback {
	message: (text: string) => void;
	shake: () => void;
}

/**
 * Resolves, validates, and dispatches one farming action (click or Space) at a
 * tile, driving the combo tracker and scythe sweep. Extracted from the scene to
 * keep it within the repository's size budget.
 */
export function performFarmAction(
	owner: string,
	combo: ComboController,
	sweepFx: SweepFx,
	column: number,
	row: number,
	feedback: ActionFeedback,
): void {
	const farm = useGameStore.getState().activeFarm;
	const tile = farm?.tiles.find((t) => t.x === column && t.y === row);
	const inventory = useInventoryStore.getState();
	const item = inventory.hotbar[inventory.selectedHotbar]?.itemId ?? null;
	const tool = farmToolForItem(item);
	if (!tool) {
		feedback.message("Select a tool or item first.");
		return;
	}
	const resolution = resolveAction(tool, tile, isTillableTile(column, row));

	if (!resolution.ok) {
		feedback.message(resolution.reason);
		if (resolution.shake) feedback.shake();
		return;
	}

	const plan = resolution.plan;
	let crop: CropId | undefined;
	if (plan.kind === "plant") {
		const seed = consumeSeedItem();
		if (!seed) {
			feedback.message("Out of seeds — buy more at the market.");
			return;
		}
		crop = seed;
	}

	combo.register(plan.kind, tile);
	if (plan.tool === "scythe") {
		sweepFx.play(
			column * TILE_SIZE + TILE_SIZE / 2,
			row * TILE_SIZE + TILE_SIZE - 14,
		);
	}
	spread(owner, combo, column, row, plan);

	emitFarmAction(owner, {
		kind: plan.kind,
		x: column,
		y: row,
		crop,
		tool: plan.tool,
		comboMutationMultiplier: combo.mutationMultiplier,
	});
}

/** High combos occasionally auto-apply a water or scythe to one neighbour. */
function spread(
	owner: string,
	combo: ComboController,
	column: number,
	row: number,
	plan: ActionPlan,
): void {
	if (plan.kind !== "water" && plan.tool !== "scythe") return;
	const farm = useGameStore.getState().activeFarm;
	const kind = plan.kind === "water" ? "water" : "harvest";
	const multiplier = combo.mutationMultiplier;
	maybeSpread(combo.current, farm?.tiles ?? [], column, row, kind, plan.tool, (x, y, tool) =>
		emitFarmAction(owner, { kind, x, y, tool, comboMutationMultiplier: multiplier }),
	);
}

/** Spends one selected seed and returns the crop it plants, if any. */
function consumeSeedItem(): CropId | null {
	const inventory = useInventoryStore.getState();
	const itemId = inventory.hotbar[inventory.selectedHotbar]?.itemId ?? undefined;
	const crop = cropForSeedItem(itemId);
	if (!crop || !itemId || countItem(inventory, itemId) < 1) return null;
	inventory.removeItem(itemId as ItemId, 1);
	return crop;
}
