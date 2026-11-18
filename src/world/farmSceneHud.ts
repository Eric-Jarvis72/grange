import type * as ex from "excalibur";
import type { FarmToolId } from "../../shared/farm";
import { useGameStore } from "../store";
import {
	type FarmHoveredTile,
	type FarmHudSnapshot,
	hoveredFarmTile,
} from "./farmHud";
import { TOOL_HINTS } from "./farmTools";
import { PlayerReach } from "./interaction";
import { LandBorderHint } from "./landBorder";

/**
 * Owns the farm scene's HUD text: the current hint, the hovered tile, the
 * player position, and the last pointer position used to refresh after a
 * server update.
 */
export class FarmSceneHud {
	private message = TOOL_HINTS.hoe;
	private hovered: FarmHoveredTile | null = null;
	private lastWorldPos: ex.Vector | null = null;
	private player = { x: 0, y: 0 };
	private readonly reach = new PlayerReach((message) => this.report(message));
	private readonly landHint = new LandBorderHint((text) => this.report(text));

	constructor(private readonly onUpdate: (snapshot: FarmHudSnapshot) => void) {}

	get landBorderHint(): LandBorderHint {
		return this.landHint;
	}

	setTool(tool: FarmToolId | null): void {
		this.report(tool ? TOOL_HINTS[tool] : "Select a tool or item first.");
	}

	report(message: string): void {
		this.message = message;
		this.emit();
	}

	hover(worldPos: ex.Vector): void {
		this.lastWorldPos = worldPos.clone();
		this.hovered = hoveredFarmTile(
			worldPos.x,
			worldPos.y,
			useGameStore.getState().activeFarm,
		);
		this.emit();
	}

	/**
	 * Publishes the player position for the HUD, throttled so a standing
	 * player costs no React renders per frame.
	 */
	trackPlayer(pos: { x: number; y: number }): void {
		if (!this.reach.moved(pos)) return;
		this.player = { x: pos.x, y: pos.y };
		this.emit();
	}

	/** Re-emits after a farm update, keeping the hovered tile in sync. */
	refresh(): void {
		if (this.lastWorldPos) this.hover(this.lastWorldPos);
		else this.emit();
	}

	private emit(): void {
		const farm = useGameStore.getState().activeFarm;
		this.onUpdate({
			tomatoes: farm?.tomatoes ?? 0,
			message: this.message,
			hovered: this.hovered,
			player: this.player,
		});
	}
}
