import { type CropId, CROPS } from "../../shared/crops";
import type { ActiveFarm } from "../../shared/types";
import { type ComboAction, ComboTracker } from "./comboTracker";
import { useComboStore } from "./comboStore";

type FarmTile = ActiveFarm["tiles"][number];

export function cropIdOf(tile: FarmTile): CropId {
	const [raw] = (tile.crop ?? "tomato").split(":");
	return raw in CROPS ? (raw as CropId) : "tomato";
}

/**
 * Owns the combo chain and its side effects: mirroring the count into the HUD
 * store and granting harvest bonuses. Rare-seed drops are rolled by the server
 * and delivered with the action ack, not generated here.
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
		}
		this.push(true);
	}

	/** Expires the combo when the window lapses. */
	update(): void {
		this.push(false);
	}

	private push(force: boolean): void {
		const value = this.tracker.update();
		if (!force && value === this.lastPushed) return;
		this.lastPushed = value;
		useComboStore.getState().setCombo(value, this.tracker.expiresAtMs);
	}
}
