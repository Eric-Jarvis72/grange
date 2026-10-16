import { type CropId, CROPS } from "../../shared/crops";
import type { ActiveFarm } from "../../shared/types";
import { useInventoryStore } from "../inventory/inventoryStore";
import type { ItemId } from "../inventory/items";
import { useNotificationStore } from "../notifications/notificationStore";
import { useGameStore } from "../store";
import { type ComboAction, ComboTracker } from "./comboTracker";
import { useComboStore } from "./comboStore";
import { activeFarmSynergy, rollMutation } from "./farmActions";

type FarmTile = ActiveFarm["tiles"][number];

export function cropIdOf(tile: FarmTile): CropId {
	const [raw] = (tile.crop ?? "tomato").split(":");
	return raw in CROPS ? (raw as CropId) : "tomato";
}

/**
 * Owns the combo chain and its side effects: mirroring the count into the HUD
 * store, granting harvest bonuses, and rolling rare mutation seeds. Keeping it
 * out of the scene keeps FarmMapScene within the repository's size budget.
 */
export class ComboController {
	private readonly tracker = new ComboTracker();
	private lastPushed = -1;

	get current(): number {
		return this.tracker.current;
	}

	get moveSpeed(): number {
		return this.tracker.perks().moveSpeed;
	}

	get mutationMultiplier(): number {
		return this.tracker.perks().mutationMultiplier;
	}

	noteHotbarSwap(): void {
		this.tracker.noteHotbarSwap();
	}

	/** Records a valid action and its harvest side effects. */
	register(kind: ComboAction, tile?: FarmTile): void {
		this.tracker.register(kind);
		if (kind === "harvest" && tile) {
			const cropId = cropIdOf(tile);
			const bonus = CROPS[cropId].comboBonus ?? 0;
			if (bonus) this.tracker.add(bonus);
			this.rollRareSeed(tile, cropId);
		}
		this.push(true);
	}

	/** Expires the combo when the window lapses. */
	update(): void {
		this.push(false);
	}

	private rollRareSeed(tile: FarmTile, cropId: CropId): void {
		if (tile.state !== "ready") return;
		const farm = useGameStore.getState().activeFarm;
		const synergy = activeFarmSynergy(tile, farm?.tiles ?? []);
		const seed = rollMutation(cropId, this.tracker.current, synergy);
		if (!seed) return;
		useInventoryStore.getState().addItem(seed as ItemId, 1);
		useNotificationStore
			.getState()
			.push(`Rare ${CROPS[cropId].name} seed!`, "system");
	}

	private push(force: boolean): void {
		const value = this.tracker.update();
		if (!force && value === this.lastPushed) return;
		this.lastPushed = value;
		useComboStore.getState().setCombo(value, this.tracker.expiresAtMs);
	}
}
