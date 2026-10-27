import * as ex from "excalibur";
import { updateFarmerGraphics } from "./farmerSprite";
import { type Horse, spawnHorses } from "./horse";
import type { HorseSpawn } from "./horseData";
import { nearestWithin } from "./horseLogic";
import type { InputManager, InputVector } from "./InputManager";
import { updateFarmPlayer } from "./playerMovement";
import type { WalkObstacle } from "./walkCollisions";

/** How close the player must stand to mount a wandering horse. */
const MOUNT_RANGE = 70;
/** Small step down on dismount so the farmer stands in front of the horse
 * instead of overlapping its body. */
const DISMOUNT_STEP_Y = 14;

/**
 * Owns the farm herd and the mount/dismount interaction. Off a horse it walks
 * and animates the farmer exactly as before; while mounted the horse takes the
 * player's input (walking in all directions, flipping and animating) and the
 * farmer is hidden, riding along at the horse's position.
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
	 * Runs one frame of mount/dismount input and drives the player or their
	 * horse. Call after the gate/train checks so the ride prompt wins when the
	 * player is standing beside a horse.
	 */
	update(
		player: ex.Actor,
		input: InputManager,
		direction: InputVector,
		delta: number,
		speedMultiplier: number,
	): void {
		const horse = this.ridden;
		if (horse) {
			horse.ride(direction, delta, speedMultiplier);
			player.pos = horse.pos.clone();
			player.graphics.visible = false;
			this.setPrompt("Press E or Enter to dismount");
			if (input.consumePress("KeyE", "Enter")) this.dismount(player);
			return;
		}

		updateFarmPlayer(player, direction, delta, speedMultiplier);
		updateFarmerGraphics(player, direction);

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
