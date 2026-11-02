import * as ex from "excalibur";
import { addFarmerGraphics } from "./farmerSprite";
import { FARM_PLAYER_SPAWN, farmBounds, MAP_HEIGHT, MAP_WIDTH, TILE_SIZE } from "./mapData";

export function createFarmPlayer(scene: ex.Scene): ex.Actor {
	const player = new ex.Actor({
		pos: ex.vec(FARM_PLAYER_SPAWN.x, FARM_PLAYER_SPAWN.y),
		width: 32,
		height: 32,
		anchor: ex.vec(0.5, 1),
		z: 200,
	});
	addFarmerGraphics(player);
	scene.add(player);
	return player;
}

export function followFarmPlayer(camera: ex.Camera, position: ex.Vector, level: number): void {
	const bounds = farmBounds(level);
	const minX = bounds.minColumn * TILE_SIZE;
	const maxX = (bounds.maxColumn + 1) * TILE_SIZE;
	const minY = bounds.minRow * TILE_SIZE;
	camera.pos = ex.vec(
		ex.clamp(position.x, minX + MAP_WIDTH / 2, maxX - MAP_WIDTH / 2),
		ex.clamp(position.y, minY + MAP_HEIGHT / 2, MAP_HEIGHT / 2),
	);
}
