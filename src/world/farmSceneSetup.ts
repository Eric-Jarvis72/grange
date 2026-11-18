import * as ex from "excalibur";
import { depthForY } from "./depth";
import { addFarmerGraphics, updateFarmerGraphics } from "./farmerSprite";
import type { HorseRiding } from "./horseRiding";
import type { InputManager, InputVector } from "./InputManager";
import type { LandBorderHint } from "./landBorder";
import {
	FARM_PLAYER_SPAWN,
	farmBounds,
	MAP_HEIGHT,
	MAP_WIDTH,
	TILE_SIZE,
} from "./mapData";
import { updateFarmPlayer } from "./playerMovement";
import { cameraAxis } from "./viewport";
import { publishViewTransform } from "./viewTransform";

export function createFarmPlayer(scene: ex.Scene): ex.Actor {
	const player = new ex.Actor({
		pos: ex.vec(FARM_PLAYER_SPAWN.x, FARM_PLAYER_SPAWN.y),
		width: 32,
		height: 32,
		anchor: ex.vec(0.5, 1),
		z: depthForY(FARM_PLAYER_SPAWN.y),
	});
	addFarmerGraphics(player);
	scene.add(player);
	return player;
}

/** Stops the farmer and swallows an interact press while an overlay owns input. */
export function freezeFarmPlayer(player: ex.Actor, input: InputManager): void {
	player.vel = ex.vec(0, 0);
	updateFarmerGraphics(player, { x: 0, y: 0 });
	input.consumePress("KeyE", "Enter");
}

/**
 * Moves the farmer (or their horse), follows with the camera, and reports the
 * throttled HUD position. One call per frame keeps the scene's update small.
 */
export function moveFarmPlayer(
	player: ex.Actor,
	camera: ex.Camera,
	engine: ex.Engine,
	riding: HorseRiding,
	direction: InputVector,
	step: number,
	speedMultiplier: number,
	landLevel: number,
	landHint: LandBorderHint,
	trackPlayer: (pos: { x: number; y: number }) => void,
): void {
	if (!riding.ride(player, direction, step, speedMultiplier)) {
		updateFarmPlayer(
			player,
			direction,
			step,
			speedMultiplier,
			landLevel,
			landHint,
		);
		updateFarmerGraphics(player, direction);
	}
	followFarmPlayer(camera, player.pos, landLevel, engine);
	publishViewTransform(engine, camera);
	trackPlayer(player.pos);
}

export function followFarmPlayer(
	camera: ex.Camera,
	position: ex.Vector,
	level: number,
	engine?: ex.Engine,
): void {
	const halfWidth = engine?.halfDrawWidth ?? MAP_WIDTH / 2;
	const halfHeight = engine?.halfDrawHeight ?? MAP_HEIGHT / 2;
	const bounds = farmBounds(level);
	// A viewport wider than the owned land stays centred on the farm and lets
	// the scenic backdrop show at the edges instead of pinning to one corner.
	camera.pos = ex.vec(
		cameraAxis(
			position.x,
			halfWidth,
			bounds.minColumn * TILE_SIZE,
			(bounds.maxColumn + 1) * TILE_SIZE,
		),
		cameraAxis(position.y, halfHeight, bounds.minRow * TILE_SIZE, MAP_HEIGHT),
	);
}
