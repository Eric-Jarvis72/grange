import * as ex from "excalibur";
import { MAP_WIDTH } from "./mapData";
import {
	smokeImages,
	trainFrameImages,
	trainImage,
	trainTracksImage,
} from "./resources";

/** The train's departure/arrival lasts this long, advanced in discrete frames
 * for a chunky, pixel-art feel (20 steps a second). */
const TRAVEL_MS = 2_000;
const PIXEL_STEP_MS = 50;
const TRAVEL_STEPS = TRAVEL_MS / PIXEL_STEP_MS;
/** The committed track art is a full-resolution copy of the source strip, so it
 * uses the train's own scale to match its pixel density. */
const TRACK_RESOLUTION = 1;
/** Distance from the top of the track art to the rail the wheels sit on, as a
 * fraction of the art's height. Seats the train on the track. */
const RAIL_FRACTION = 0.655;
/** Extra padding past the map edge so the train is fully off-screen. */
const OFFSCREEN_MARGIN = 8;
/** How long each wheel pose is held at the train's top speed, in ms. The wheels
 * slow down when the train does (see `wheelSpeed`). */
const WHEEL_FRAME_MS = 100;
/** Smoke uses the same frame duration so small -> med -> big stays in 1:1
 * lockstep with the three wheel poses. */
/** Horizontal distance from the train's centre to the smokestack mouth, as a
 * fraction of the displayed train width. Measured from the stack rim in
 * `starter-train.webp` (rim centre ~0.877 across, so ~0.377 right of centre).
 * Mirrored when the train faces left. */
const STACK_DX_FRACTION = 0.377;
/** Source pixels from the top of `starter-train.webp` to the stack mouth. */
const STACK_TOP_PX = 6;
/** How far the smoke base tucks into the stack mouth, in source pixels, so no
 * gap opens between frames of different heights. */
const SMOKE_SINK_PX = 8;
/** Slowest the wheels may spin, as a fraction of top speed, so they keep
 * crawling while the train is barely moving. */
const MIN_WHEEL_SPEED = 0.35;
/** Steepest slope the trip easings reach (both quadratics peak at 2), used to
 * normalise speed to a 0-1 fraction. */
const TOP_EASING_SLOPE = 2;

/** Single-argument easings: slow start (accelerate) and slow end (brake). */
const easeInQuad = (t: number) => t * t;
const easeOutQuad = (t: number) => t * (2 - t);
const linear = (t: number) => t;

export interface TrainRest {
	/** Centre x of the train at rest. */
	x: number;
	/** World y of the train's base (anchored bottom-centre). */
	y: number;
	/** Displayed width of the train sprite. */
	width: number;
}

/** The placement fields the train reads from a scene's prop list. */
export interface TrainProp {
	asset: string;
	x: number;
	y: number;
	width: number;
}

export function findTrainRest(props: TrainProp[]): TrainRest {
	const prop = props.find((candidate) => candidate.asset === "starter-train");
	if (!prop) throw new Error("No starter-train prop found for this scene.");
	return { x: prop.x, y: prop.y, width: prop.width };
}

/** Tiles a static, full-width track across the scene under the train. */
function addTrainTracks(scene: ex.Scene, rest: TrainRest, scale: number): void {
	const tileWidth = trainTracksImage.width * scale;
	const copies = Math.ceil(MAP_WIDTH / tileWidth) + 1;
	const trackY =
		rest.y - (RAIL_FRACTION - 0.5) * trainTracksImage.height * scale;
	for (let i = 0; i < copies; i += 1) {
		const actor = new ex.Actor({
			pos: ex.vec(i * tileWidth, trackY),
			anchor: ex.vec(0, 0.5),
			z: 1,
		});
		const sprite = trainTracksImage.toSprite();
		sprite.scale = ex.vec(scale, scale);
		actor.graphics.use(sprite);
		scene.add(actor);
	}
}

/** Builds the seamless wheel loop the train plays while moving: the parked
 * pose followed by the two extra frames, each scaled to the same on-screen
 * width so the train never changes size between poses. */
function buildWheelAnimation(
	rest: TrainRest,
	flipHorizontal: boolean,
): ex.Animation {
	const sources = [trainImage, ...trainFrameImages];
	return new ex.Animation({
		frames: sources.map((source) => {
			const sprite = source.toSprite();
			const scale = rest.width / source.width;
			sprite.scale = ex.vec(scale, scale);
			sprite.flipHorizontal = flipHorizontal;
			return { graphic: sprite, duration: WHEEL_FRAME_MS };
		}),
		strategy: ex.AnimationStrategy.Loop,
	});
}

/** Builds the smoke loop played above the stack while moving: small, med,
 * big in order. Every smoke frame uses the train's own pixel scale (not a
 * per-frame fit) so puffs grow bottom-up and pixel density matches the train.
 * Same per-frame duration as the wheels so the two loops stay in lockstep. */
function buildSmokeAnimation(
	trainScale: number,
	flipHorizontal: boolean,
): ex.Animation {
	return new ex.Animation({
		frames: smokeImages.map((source) => {
			const sprite = source.toSprite();
			sprite.scale = ex.vec(trainScale, trainScale);
			sprite.flipHorizontal = flipHorizontal;
			return { graphic: sprite, duration: WHEEL_FRAME_MS };
		}),
		strategy: ex.AnimationStrategy.Loop,
	});
}

type TrainState = "idle" | "arriving" | "departing" | "gone";

/**
 * Owns one scene's animated train. It rests on the right side of a full-width
 * track, steps in from the left when arriving, and steps off the right edge
 * when the player boards it. Movement is quantised to whole pixels at a fixed
 * cadence so it reads as pixel art rather than a smooth tween. Gate travel
 * prompts on `canBoard`; hide the player while `isMoving`.
 */
export class TrainController {
	private readonly actor: ex.Actor;
	private readonly wheelAnimation: ex.Animation;
	private readonly smokeActor: ex.Actor;
	private readonly smokeAnimation: ex.Animation;
	private readonly flipHorizontal: boolean;
	private readonly trainScale: number;
	private state: TrainState = "idle";
	private elapsed = 0;
	private step = 0;
	private fromX = 0;
	private toX = 0;
	private easing: (t: number) => number = linear;
	private onDone: (() => void) | null = null;

	constructor(
		private readonly rest: TrainRest,
		scene: ex.Scene,
		flipHorizontal = false,
	) {
		this.flipHorizontal = flipHorizontal;
		this.trainScale = rest.width / trainImage.width;
		const scale = this.trainScale;
		const sprite = trainImage.toSprite();
		sprite.scale = ex.vec(scale, scale);
		sprite.flipHorizontal = flipHorizontal;
		const z = 100 + Math.floor(rest.y);
		this.actor = new ex.Actor({
			pos: ex.vec(rest.x, rest.y),
			anchor: ex.vec(0.5, 1),
			z,
		});
		this.wheelAnimation = buildWheelAnimation(rest, flipHorizontal);
		this.actor.graphics.add("parked", sprite);
		this.actor.graphics.add("moving", this.wheelAnimation);
		this.actor.graphics.use("parked");
		scene.add(this.actor);

		this.smokeAnimation = buildSmokeAnimation(scale, flipHorizontal);
		// Bottom outer corner anchored to the stack mouth: the smoke art
		// trails from its low end (right side, mirrored when flipped), so
		// the plume grows up and away from the stack instead of straddling
		// it. Corner-anchoring also keeps every frame's origin on the stack
		// with no sideways jump between sizes.
		this.smokeActor = new ex.Actor({
			pos: this.smokePosFor(this.actor.pos),
			anchor: ex.vec(flipHorizontal ? 0 : 1, 1),
			z: z + 1,
		});
		this.smokeActor.graphics.use(this.smokeAnimation);
		this.smokeActor.graphics.visible = false;
		scene.add(this.smokeActor);

		addTrainTracks(scene, rest, scale * TRACK_RESOLUTION);
	}

	/** Whether the train is parked and the player may board it. */
	canBoard(): boolean {
		return this.isParked();
	}

	/** True only while the train sits at its stop, so the player is on the
	 * platform: visible and free to move. False while arriving, departing, or
	 * gone. */
	isParked(): boolean {
		return this.state === "idle";
	}

	private isTravelling(): boolean {
		return this.state === "arriving" || this.state === "departing";
	}

	/** The train's speed as a fraction of top speed, taken from the current
	 * easing's slope, so the wheels spin faster the faster the train moves.
	 * Clamped at the ends so the difference always has a span to divide by. */
	private wheelSpeed(): number {
		const dt = 1 / TRAVEL_STEPS;
		const t = Math.min(this.step / TRAVEL_STEPS, 1);
		const lo = Math.max(0, t - dt);
		const hi = Math.min(1, t + dt);
		const slope = (this.easing(hi) - this.easing(lo)) / (hi - lo);
		return Math.max(MIN_WHEEL_SPEED, Math.min(slope / TOP_EASING_SLOPE, 1));
	}

	/** Parks the train, or steps it in from off-screen left when arriving. */
	reset(arriving = false): void {
		if (!arriving) {
			this.state = "idle";
			this.actor.pos = ex.vec(this.rest.x, this.rest.y);
			this.actor.graphics.use("parked");
			this.smokeActor.graphics.visible = false;
			this.syncSmokePos();
			return;
		}
		this.beginTrip(
			this.offscreenLeftX(),
			this.rest.x,
			easeOutQuad,
			"arriving",
			null,
		);
	}

	/** Steps off the right edge, then reports that it has left. */
	depart(onDeparted: () => void): void {
		if (this.state === "departing" || this.state === "gone") return;
		this.beginTrip(
			this.rest.x,
			this.offscreenRightX(),
			easeInQuad,
			"departing",
			onDeparted,
		);
	}

	/** Advances the stepped animation; call once per frame. */
	update(delta: number): void {
		if (!this.isTravelling()) return;
		this.elapsed += delta;
		while (this.elapsed >= PIXEL_STEP_MS && this.isTravelling()) {
			this.elapsed -= PIXEL_STEP_MS;
			this.step += 1;
			const t = Math.min(this.step / TRAVEL_STEPS, 1);
			const eased = this.easing(t);
			this.actor.pos = ex.vec(
				Math.round(this.fromX + (this.toX - this.fromX) * eased),
				this.rest.y,
			);
			this.syncSmokePos();
			if (t >= 1) this.finishTrip();
		}
		if (this.isTravelling()) {
			this.syncSmokeFrame();
		}
	}

	private beginTrip(
		fromX: number,
		toX: number,
		easing: (t: number) => number,
		state: TrainState,
		onDone: (() => void) | null,
	): void {
		this.fromX = fromX;
		this.toX = toX;
		this.easing = easing;
		this.onDone = onDone;
		this.state = state;
		this.elapsed = 0;
		this.step = 0;
		this.actor.pos = ex.vec(fromX, this.rest.y);
		this.wheelAnimation.reset();
		this.smokeAnimation.reset();
		this.syncSmokeFrame();
		this.actor.graphics.use("moving");
		this.smokeActor.graphics.visible = true;
		this.syncSmokePos();
	}

	private finishTrip(): void {
		const done = this.onDone;
		this.onDone = null;
		if (this.state === "departing") {
			this.state = "gone";
			this.smokeActor.graphics.visible = false;
			done?.();
		} else {
			this.state = "idle";
			this.actor.graphics.use("parked");
			this.smokeActor.graphics.visible = false;
		}
	}

	/** World position of the smoke origin (bottom outer corner) for a given
	 * train position: the plume's low end sits on the stack mouth, tucked
	 * slightly into it. */
	private smokePosFor(trainPos: ex.Vector): ex.Vector {
		const dx =
			STACK_DX_FRACTION * this.rest.width * (this.flipHorizontal ? -1 : 1);
		const dy =
			(trainImage.height - STACK_TOP_PX - SMOKE_SINK_PX) * this.trainScale;
		return ex.vec(trainPos.x + dx, trainPos.y - dy);
	}

	private syncSmokePos(): void {
		this.smokeActor.pos = this.smokePosFor(this.actor.pos);
	}

	/** Keeps smoke and wheels on the same clock and corrects drift so smoke
	 * frame N always shows with wheel frame N (small, med, big). */
	private syncSmokeFrame(): void {
		const speed = this.wheelSpeed();
		this.wheelAnimation.speed = speed;
		this.smokeAnimation.speed = speed;
		if (
			this.smokeAnimation.currentFrameIndex !==
			this.wheelAnimation.currentFrameIndex
		) {
			this.smokeAnimation.goToFrame(this.wheelAnimation.currentFrameIndex);
		}
	}

	private offscreenLeftX(): number {
		return -this.rest.width / 2 - OFFSCREEN_MARGIN;
	}

	private offscreenRightX(): number {
		return MAP_WIDTH + this.rest.width / 2 + OFFSCREEN_MARGIN;
	}
}
