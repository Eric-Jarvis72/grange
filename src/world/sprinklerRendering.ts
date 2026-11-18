import * as ex from "excalibur";
import type { FarmSprinkler } from "../../shared/types";
import { sprinklerCorner, sprinklerKey } from "./sprinklerData";
import {
	sprinklerBaseImage,
	sprinklerRotorImage,
	sprinklerWaterImage,
} from "./sprinklerResources";

/** A sprinkler sprays briefly once a minute rather than constantly. */
const SPIN_INTERVAL_MS = 60_000;
const SPIN_DURATION_MS = 900;
const SPRINKLER_WIDTH = 56;
const WATER_WIDTH = 74;

/**
 * Ground-level depth, below the crop sprites (which start at z 10 + row), so a
 * mature plant always draws in front of the sprinkler instead of being cut by it.
 */
const BASE_Z = 5;
const ROTOR_Z = 6;
const WATER_Z = 7;

interface SprinklerActors {
	base: ex.Actor;
	rotor: ex.Actor;
	water: ex.Actor;
	clock: number;
	offset: number;
}

/** Owns the placed sprinkler sprites and their periodic spray animation. */
export class SprinklerLayer {
	private actors: SprinklerActors[] = [];
	private signature = "";

	constructor(private readonly scene: ex.Scene) {}

	set(sprinklers: FarmSprinkler[]): void {
		const signature = sprinklers
			.map(({ x, y }) => sprinklerKey(x, y))
			.sort()
			.join("|");
		if (signature === this.signature) return;
		this.signature = signature;
		for (const { base, rotor, water } of this.actors) {
			this.scene.remove(base);
			this.scene.remove(rotor);
			this.scene.remove(water);
		}
		this.actors = sprinklers.map((sprinkler, index) => {
			const corner = sprinklerCorner(sprinkler.x, sprinkler.y);
			const base = this.makeActor(sprinklerBaseImage, corner, SPRINKLER_WIDTH, BASE_Z);
			const rotor = this.makeActor(sprinklerRotorImage, corner, SPRINKLER_WIDTH, ROTOR_Z);
			const water = this.makeActor(sprinklerWaterImage, corner, WATER_WIDTH, WATER_Z);
			water.graphics.opacity = 0;
			// Stagger the sprays so a field of sprinklers does not pulse in unison.
			return { base, rotor, water, clock: 0, offset: (index % 4) * 260 };
		});
	}

	update(step: number): void {
		for (const spin of this.actors) {
			spin.clock += step;
			const phase =
				(((spin.clock - spin.offset) % SPIN_INTERVAL_MS) + SPIN_INTERVAL_MS) %
				SPIN_INTERVAL_MS;
			if (phase < SPIN_DURATION_MS) {
				const t = phase / SPIN_DURATION_MS;
				// Only the brass rotor turns; the base stays put.
				spin.rotor.rotation = t * Math.PI * 4;
				const burst = 0.5 + 0.65 * t;
				spin.water.scale = ex.vec(burst, burst);
				spin.water.graphics.opacity = Math.sin(t * Math.PI) * 0.9;
			} else {
				spin.rotor.rotation = 0;
				spin.water.graphics.opacity = 0;
			}
		}
	}

	private makeActor(
		source: ex.ImageSource,
		corner: { x: number; y: number },
		width: number,
		z: number,
	): ex.Actor {
		const sprite = source.toSprite();
		const scale = width / source.width;
		sprite.scale = ex.vec(scale, scale);
		const actor = new ex.Actor({
			pos: ex.vec(corner.x, corner.y),
			anchor: ex.vec(0.5, 0.5),
			z,
		});
		actor.graphics.use(sprite);
		this.scene.add(actor);
		return actor;
	}
}
