import * as ex from "excalibur";
import type { InputVector } from "./InputManager";
import { farmBounds, MAP_HEIGHT, MAP_WIDTH, TILE_SIZE } from "./mapData";
import { farmWalkObstacles } from "./sceneObstacles";
import { moveAroundObstacles, type WalkObstacle } from "./walkCollisions";

/** Farm movement uses the same speed as the other walking scenes. */
export function updateFarmPlayer(
	player: ex.Actor,
	direction: InputVector,
	delta: number,
	speedMultiplier = 1,
	landLevel = 0,
): void {
	const bounds = farmBounds(landLevel);
	updateWalkingPlayer(
		player,
		direction,
		160 * speedMultiplier,
		delta,
		farmWalkObstacles,
		(bounds.maxColumn + 1) * TILE_SIZE,
		MAP_HEIGHT,
		bounds.minColumn * TILE_SIZE,
		bounds.minRow * TILE_SIZE,
	);
}

export function updateWalkingPlayer(
	player: ex.Actor,
	direction: InputVector,
	speed: number,
	delta: number,
	obstacles: WalkObstacle[],
	worldWidth = MAP_WIDTH,
	worldHeight = MAP_HEIGHT,
	worldMinX = 0,
	worldMinY = 0,
): void {
	const step = (speed * Math.min(delta, 100)) / 1000;
	const next = moveAroundObstacles(
		player.pos.x,
		player.pos.y,
		direction.x * step,
		direction.y * step,
		obstacles,
	);
	player.vel = ex.Vector.Zero;
	player.pos.x = ex.clamp(next.x, worldMinX + 16, worldWidth - 16);
	player.pos.y = ex.clamp(next.y, worldMinY + 32, worldHeight - 16);
	player.z = 100 + Math.floor(player.pos.y);
}
