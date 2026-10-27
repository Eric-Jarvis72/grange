import * as ex from "excalibur";
import { frameSourceViews, type HorseFacing, type SourceView } from "./horseLogic";
import { type HorseColor, horseArt } from "./horseResources";

/** Every horse is drawn this many world pixels wide (a little over one tile). */
export const HORSE_DISPLAY_WIDTH = 91;
/** Frames packed across each walk strip. */
export const HORSE_WALK_FRAMES = 4;
/** Milliseconds each walk frame is held. */
const WALK_FRAME_MS = 140;

export interface HorseGraphics {
	idle: ex.Sprite;
	walk: ex.Animation;
	/** Every sprite that flips together when the horse turns around. */
	sprites: ex.Sprite[];
}

function scaledSprite(
	image: ex.ImageSource,
	view: SourceView,
	scale: number,
): ex.Sprite {
	const sprite = new ex.Sprite({ image, sourceView: view });
	sprite.scale = ex.vec(scale, scale);
	return sprite;
}

/** Builds a fresh, independently animated set of graphics for one horse.
 * Each call returns its own sprites and animation so horses never share a
 * playback clock. */
export function buildHorseGraphics(color: HorseColor): HorseGraphics {
	const art = horseArt[color];
	const idleScale = HORSE_DISPLAY_WIDTH / art.idle.width;
	const walkScale = (HORSE_DISPLAY_WIDTH * HORSE_WALK_FRAMES) / art.walk.width;
	const idle = scaledSprite(
		art.idle,
		{ x: 0, y: 0, width: art.idle.width, height: art.idle.height },
		idleScale,
	);
	const walkSprites = frameSourceViews(
		art.walk.width,
		art.walk.height,
		HORSE_WALK_FRAMES,
	).map((view) => scaledSprite(art.walk, view, walkScale));
	const walk = new ex.Animation({
		frames: walkSprites.map((graphic) => ({
			graphic,
			duration: WALK_FRAME_MS,
		})),
		strategy: ex.AnimationStrategy.Loop,
	});
	return { idle, walk, sprites: [idle, ...walkSprites] };
}

export function addHorseGraphics(
	actor: ex.Actor,
	graphics: HorseGraphics,
): void {
	actor.graphics.add("idle", graphics.idle);
	actor.graphics.add("walk", graphics.walk);
	actor.graphics.use("idle");
}

/** Plays the walk cycle while moving and the standing pose while idle, flipping
 * every sprite so the horse faces its travel direction. */
export function updateHorseGraphics(
	actor: ex.Actor,
	graphics: HorseGraphics,
	facing: HorseFacing,
	moving: boolean,
): void {
	const flip = facing === "left";
	for (const sprite of graphics.sprites) sprite.flipHorizontal = flip;
	const name = moving ? "walk" : "idle";
	if (actor.graphics.current !== actor.graphics.getGraphic(name)) {
		actor.graphics.use(name);
	}
}
