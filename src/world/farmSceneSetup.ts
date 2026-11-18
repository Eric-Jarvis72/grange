import * as ex from "excalibur";
import { depthForY } from "./depth";
import { addFarmerGraphics } from "./farmerSprite";
import { FARM_PLAYER_SPAWN, farmBounds, MAP_HEIGHT, MAP_WIDTH, TILE_SIZE } from "./mapData";
import { cameraAxis } from "./viewport";

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
		cameraAxis(
			position.y,
			halfHeight,
			bounds.minRow * TILE_SIZE,
			MAP_HEIGHT,
		),
	);
}
