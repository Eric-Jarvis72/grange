import type * as ex from "excalibur";
import { BonkFx } from "./bonkFx";
import type { BonkTarget } from "./hubPlayers";

/**
 * Plays the comic shovel bonk for a visitor that the presence layer found.
 *
 * Extracted from the farm scene so the scene only forwards pointer hits while
 * this helper owns the burst, knockback cue, and HUD shout.
 */
export class FarmBonk {
	private readonly fx: BonkFx;

	constructor(
		private readonly scene: ex.Scene,
		private readonly report: (text: string) => void,
	) {
		this.fx = new BonkFx(scene);
	}

	/** Starts the burst on a hit visitor. */
	play(target: BonkTarget): void {
		this.fx.play(target.x, target.y - 40);
		this.scene.camera.shake(3, 3, 140);
		this.report("BONK!");
	}

	update(deltaMs: number): void {
		this.fx.update(deltaMs);
	}

	clear(): void {
		this.fx.clear();
	}
}
