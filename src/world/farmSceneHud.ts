import type * as ex from "excalibur";
import { useGameStore } from "../store";
import {
	type FarmHoveredTile,
	type FarmHudSnapshot,
	hoveredFarmTile,
} from "./farmHud";

/**
 * Owns the farm HUD's transient state - the held message, the hovered tile, and
 * the last cursor position - and publishes snapshots back to React. Kept out of
 * FarmMapScene so that class stays within the file budget.
 */
export class FarmSceneHud {
	private message: string;
	private hovered: FarmHoveredTile | null = null;
	private lastWorldPos: ex.Vector | null = null;

	constructor(
		initialMessage: string,
		private readonly publish: (snapshot: FarmHudSnapshot) => void,
	) {
		this.message = initialMessage;
	}

	/** Sets the current hint or error and republishes the snapshot. */
	setMessage(text: string): void {
		this.message = text;
		this.emit();
	}

	/** Recomputes the hovered tile for a world position and republishes. */
	updateHover(worldPos: ex.Vector): void {
		this.lastWorldPos = worldPos.clone();
		this.hovered = hoveredFarmTile(worldPos.x, worldPos.y,
			useGameStore.getState().activeFarm);
		this.emit();
	}

	/** Re-hovers the last cursor position after the farm changed. */
	refresh(): void {
		if (this.lastWorldPos) this.updateHover(this.lastWorldPos);
		else this.emit();
	}

	emit(): void {
		const farm = useGameStore.getState().activeFarm;
		this.publish({
			tomatoes: farm?.tomatoes ?? 0,
			message: this.message,
			hovered: this.hovered,
		});
	}
}
