import * as ex from "excalibur";
import { HORSE_SPAWNS, type HorseSpawn } from "./horseData";
import {
	clamp,
	facingFor,
	type HorseFacing,
	idleDuration,
	pickWanderTarget,
	type Point,
	type WanderBounds,
} from "./horseLogic";
import {
	addHorseGraphics,
	buildHorseGraphics,
	type HorseGraphics,
	updateHorseGraphics,
} from "./horseSprite";
import { placeholderSquareImage } from "./horseResources";
import type { InputVector } from "./InputManager";
import { MAP_HEIGHT, MAP_WIDTH } from "./mapData";
import { moveAroundObstacles, type WalkObstacle } from "./walkCollisions";

/** Ambient grazing speed, comfortably slower than the farmer's brisk 160. */
const WALK_SPEED = 52;
/** Speed while a player is riding, a little brisker than walking on foot. */
const RIDE_SPEED = 205;
/** How close counts as "arrived" at a wander target. */
const ARRIVE_DISTANCE = 6;
/** Give up on a target after being pinned against scenery this long. */
const STUCK_MS = 500;
/** Feet footprint used to slide around props, fences, and the shoreline. */
const FEET_RADIUS = 14;
/** Longest single physics step, so a background tab cannot teleport a horse. */
const MAX_STEP_MS = 100;
/** Size of the placeholder square overlay, in world pixels. */
const PLACEHOLDER_SIZE = 32;
/** How far above the horse's feet the placeholder sits (over its back). */
const PLACEHOLDER_OFFSET_Y = -48;

/** World-space limits horses never leave. */
const WORLD_BOUNDS: WanderBounds = {
	left: 40,
	right: MAP_WIDTH - 40,
	top: 60,
	bottom: MAP_HEIGHT - 48,
};

/**
 * One wandering farm horse. It grazes (idle) in place, walks to a random point
 * inside its roam circle, and repeats. Movement slides around scenery with the
 * same collision helper the player uses, and the sprite flips to face the way
 * it travels, playing the walk cycle only while it is actually moving.
 */
export class Horse extends ex.Actor {
	private readonly art: HorseGraphics;
	private readonly placeholder: ex.Actor;
	private readonly home: Point;
	private readonly roam: number;
	private readonly obstacles: WalkObstacle[];
	private readonly random: () => number;
	private facing: HorseFacing = "right";
	private walking = false;
	private mounted = false;
	private idleRemaining = 0;
	private target: Point;
	private lastPos: ex.Vector;
	private stuckTime = 0;

	constructor(
		spawn: HorseSpawn,
		scene: ex.Scene,
		obstacles: WalkObstacle[],
		random: () => number = Math.random,
	) {
		super({
			pos: ex.vec(spawn.x, spawn.y),
			width: 56,
			height: 36,
			anchor: ex.vec(0.5, 1),
			z: 100 + Math.floor(spawn.y),
		});
		this.home = { x: spawn.x, y: spawn.y };
		this.roam = spawn.roam;
		this.obstacles = obstacles;
		this.random = random;
		this.target = { x: spawn.x, y: spawn.y };
		this.art = buildHorseGraphics(spawn.color);
		addHorseGraphics(this, this.art);
		this.placeholder = this.buildPlaceholder();
		this.lastPos = this.pos.clone();
		this.idleRemaining = idleDuration(this.random);
		scene.add(this);
		scene.add(this.placeholder);
	}

	/** Placeholder square drawn on top of the horse until real art replaces it. */
	private buildPlaceholder(): ex.Actor {
		const square = placeholderSquareImage.toSprite();
		const scale = PLACEHOLDER_SIZE / placeholderSquareImage.width;
		square.scale = ex.vec(scale, scale);
		const actor = new ex.Actor({
			pos: ex.vec(this.pos.x, this.pos.y + PLACEHOLDER_OFFSET_Y),
			anchor: ex.vec(0.5, 0.5),
			z: this.z + 1,
		});
		actor.graphics.use(square);
		actor.graphics.visible = false;
		return actor;
	}

	/** Keeps the placeholder square sitting on the horse's back. */
	private syncPlaceholder(): void {
		this.placeholder.pos = ex.vec(this.pos.x, this.pos.y + PLACEHOLDER_OFFSET_Y);
		this.placeholder.z = this.z + 1;
	}

	override onPreUpdate(_engine: ex.Engine, elapsed: number): void {
		if (this.mounted) return;
		const step = Math.min(elapsed, MAX_STEP_MS);
		if (this.walking) {
			this.advance(step);
		} else {
			this.idleRemaining -= step;
			if (this.idleRemaining <= 0) this.beginWalk();
		}
		this.z = 100 + Math.floor(this.pos.y);
		updateHorseGraphics(this, this.art, this.facing, this.walking);
		this.syncPlaceholder();
	}

	/** True while a player is riding, which suspends the wander behaviour. */
	isMounted(): boolean {
		return this.mounted;
	}

	mount(): void {
		this.mounted = true;
		this.placeholder.graphics.visible = true;
	}

	/** Puts the horse back to grazing once its rider steps off. */
	dismount(): void {
		this.mounted = false;
		this.walking = false;
		this.idleRemaining = idleDuration(this.random);
		this.placeholder.graphics.visible = false;
	}

	/** Moves under player control while ridden: the horse takes the input vector
	 * in all directions, flipping to face travel and playing its walk cycle. */
	ride(
		direction: InputVector,
		delta: number,
		speedMultiplier = 1,
	): void {
		const step = (RIDE_SPEED * speedMultiplier * Math.min(delta, MAX_STEP_MS)) / 1000;
		const moved = moveAroundObstacles(
			this.pos.x,
			this.pos.y,
			direction.x * step,
			direction.y * step,
			this.obstacles,
			FEET_RADIUS,
		);
		this.pos = ex.vec(
			clamp(moved.x, WORLD_BOUNDS.left, WORLD_BOUNDS.right),
			clamp(moved.y, WORLD_BOUNDS.top, WORLD_BOUNDS.bottom),
		);
		const moving = direction.x !== 0 || direction.y !== 0;
		this.facing = facingFor(this.facing, direction.x);
		this.walking = moving;
		this.z = 100 + Math.floor(this.pos.y);
		updateHorseGraphics(this, this.art, this.facing, moving);
		this.syncPlaceholder();
	}

	/** Picks a fresh target and starts moving toward it. */
	private beginWalk(): void {
		this.target = pickWanderTarget(
			this.home,
			this.roam,
			WORLD_BOUNDS,
			this.random,
		);
		this.walking = true;
		this.stuckTime = 0;
		this.lastPos = this.pos.clone();
	}

	private advance(step: number): void {
		const toTargetX = this.target.x - this.pos.x;
		const toTargetY = this.target.y - this.pos.y;
		const distance = Math.hypot(toTargetX, toTargetY);
		if (distance <= ARRIVE_DISTANCE) {
			this.stop();
			return;
		}

		const travel = (WALK_SPEED * step) / 1000;
		const moved = moveAroundObstacles(
			this.pos.x,
			this.pos.y,
			(toTargetX / distance) * travel,
			(toTargetY / distance) * travel,
			this.obstacles,
			FEET_RADIUS,
		);
		const next = ex.vec(
			clamp(moved.x, WORLD_BOUNDS.left, WORLD_BOUNDS.right),
			clamp(moved.y, WORLD_BOUNDS.top, WORLD_BOUNDS.bottom),
		);
		this.pos = next;
		this.facing = facingFor(this.facing, toTargetX);
		this.trackProgress(step, next);
	}

	/** Restarts with a new target if scenery has pinned the horse in place. */
	private trackProgress(step: number, next: ex.Vector): void {
		if (next.distance(this.lastPos) < 0.3) {
			this.stuckTime += step;
			if (this.stuckTime >= STUCK_MS) this.beginWalk();
			return;
		}
		this.stuckTime = 0;
		this.lastPos = next;
	}

	private stop(): void {
		this.walking = false;
		this.idleRemaining = idleDuration(this.random);
	}
}

/** Creates every farm horse and adds it to the scene. */
export function spawnHorses(
	scene: ex.Scene,
	obstacles: WalkObstacle[],
	spawns: readonly HorseSpawn[] = HORSE_SPAWNS,
): Horse[] {
	return spawns.map((spawn) => new Horse(spawn, scene, obstacles));
}
