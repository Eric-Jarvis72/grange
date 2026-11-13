import * as ex from "excalibur";
import { type Horse, spawnHorses } from "./horse";
import type { HorseSpawn } from "./horseData";
import { nearestWithin } from "./horseLogic";
import type { InputManager, InputVector } from "./InputManager";
import type { WalkObstacle } from "./walkCollisions";

/** How close the player must stand to mount a wandering horse. */
const MOUNT_RANGE = 70;
/** Small step down on dismount so the farmer stands in front of the horse
 * instead of overlapping its body. */
const DISMOUNT_STEP_Y = 14;

/**
 * Owns the farm herd and the mount/dismount interaction. While mounted the
 * horse takes the player's input (walking in all directions, flipping and
 * animating) and the farmer is hidden, riding along at the horse's position.
 * Walking on foot stays with `FarmMapScene` so it can keep the camera, terrain
 * bounds, and depth handling it already owns.
 */
export class HorseRiding {
	private horses: Horse[] = [];
	private ridden: Horse | null = null;
	private activePrompt: string | null = null;

	constructor(
		private readonly onPromptChange: (prompt: string | null) => void,
	) {}

	/** Populates the scene with the herd. */
	spawn(
		scene: ex.Scene,
		obstacles: WalkObstacle[],
		spawns?: readonly HorseSpawn[],
	): void {
		this.horses = spawnHorses(scene, obstacles, spawns);
	}

	/** True while a horse is being ridden (the farmer is hidden). */
	isMounted(): boolean {
		return this.ridden !== null;
	}

	/**
	 * Drives the ridden horse for one frame. Returns true while a horse is
	 * mounted so the caller can skip on-foot movement.
	 */
	ride(
		player: ex.Actor,
		direction: InputVector,
		delta: number,
		speedMultiplier = 1,
	): boolean {
		const horse = this.ridden;
		if (!horse) return false;
		horse.ride(direction, delta, speedMultiplier);
		player.pos = horse.pos.clone();
		player.graphics.visible = false;
		return true;
	}

	/**
	 * Runs mount/dismount input and prompts the nearest horse. Call after the
	 * gate, train, house, and barn interactions so their E press wins.
	 */
	update(player: ex.Actor, input: InputManager): void {
		const horse = this.ridden;
		if (horse) {
			this.setPrompt("Press E or Enter to dismount");
			if (input.consumePress("KeyE", "Enter")) this.dismount(player);
			return;
		}

		const mountable = this.mountNearest(player.pos);
		this.setPrompt(mountable ? "Press E or Enter to ride a horse" : null);
		if (mountable && input.consumePress("KeyE", "Enter")) this.mount(player, mountable);
	}

	/** Steps the rider off (if any) and clears the prompt when leaving the farm. */
	deactivate(player: ex.Actor): void {
		if (this.ridden) this.dismount(player);
		this.setPrompt(null);
	}

	private mount(player: ex.Actor, horse: Horse): void {
		this.ridden = horse;
		horse.mount();
		player.pos = horse.pos.clone();
		player.graphics.visible = false;
		this.setPrompt("Press E or Enter to dismount");
	}

	private dismount(player: ex.Actor): void {
		const horse = this.ridden;
		if (horse) {
			horse.dismount();
			player.pos = ex.vec(horse.pos.x, horse.pos.y + DISMOUNT_STEP_Y);
		}
		this.ridden = null;
		player.graphics.visible = true;
	}

	private mountNearest(origin: ex.Vector): Horse | null {
		const index = nearestWithin(
			origin,
			this.horses.map((horse) => horse.pos),
			MOUNT_RANGE,
		);
		return index === -1 ? null : this.horses[index];
	}

	private setPrompt(prompt: string | null): void {
		if (prompt === this.activePrompt) return;
		this.activePrompt = prompt;
		this.onPromptChange(prompt);
	}
}
