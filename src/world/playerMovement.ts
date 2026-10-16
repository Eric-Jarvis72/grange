import * as ex from "excalibur";
import type { InputVector } from "./InputManager";
import { MAP_HEIGHT, MAP_WIDTH } from "./mapData";
import { farmWalkObstacles } from "./sceneObstacles";
import { moveAroundObstacles, type WalkObstacle } from "./walkCollisions";

/** Farm movement uses the same speed as the other walking scenes. */
export function updateFarmPlayer(
	player: ex.Actor,
	direction: InputVector,
	delta: number,
	speedMultiplier = 1,
): void {
	updateWalkingPlayer(
		player,
		direction,
		160 * speedMultiplier,
		delta,
		farmWalkObstacles,
	);
}

export function updateWalkingPlayer(
	player: ex.Actor,
	direction: InputVector,
	speed: number,
	delta: number,
	obstacles: WalkObstacle[],
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
	player.pos.x = ex.clamp(next.x, 16, MAP_WIDTH - 16);
	player.pos.y = ex.clamp(next.y, 32, MAP_HEIGHT - 16);
	player.z = 100 + Math.floor(player.pos.y);
}
