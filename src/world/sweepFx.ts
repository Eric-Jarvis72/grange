import * as ex from "excalibur";
import { sweepFxImages } from "./resources";

const FRAME_COUNT = sweepFxImages.length;
const FRAME_MS = 90;
const TARGET_HEIGHT = 72;

/**
 * Plays the three-frame scythe sweep once at a tile, then removes itself.
 * Pure scene helper so the farm scene only needs `play` and `update`.
 */
export class SweepFx {
	private actor: ex.Actor | null = null;
	private frame = 0;
	private elapsed = 0;

	constructor(private readonly scene: ex.Scene) {}

	/** Starts the swing animation centred on a world position. */
	play(x: number, y: number): void {
		this.actor?.kill();
		this.frame = 0;
		this.elapsed = 0;
		const actor = new ex.Actor({
			pos: ex.vec(x, y),
			anchor: ex.vec(0.5, 0.5),
			z: 300,
		});
		actor.graphics.use(this.spriteAt(0));
		this.scene.add(actor);
		this.actor = actor;
	}

	update(deltaMs: number): void {
		if (!this.actor) return;
		this.elapsed += deltaMs;
		const next = Math.min(FRAME_COUNT - 1, Math.floor(this.elapsed / FRAME_MS));
		if (next !== this.frame) {
			this.frame = next;
			this.actor.graphics.use(this.spriteAt(next));
		}
		if (this.elapsed >= FRAME_MS * FRAME_COUNT) {
			this.actor.kill();
			this.actor = null;
		}
	}

	private spriteAt(frame: number): ex.Sprite {
		const source = sweepFxImages[frame];
		const sprite = source.toSprite();
		const scale = TARGET_HEIGHT / source.height;
		sprite.scale = ex.vec(scale, scale);
		return sprite;
	}
}
