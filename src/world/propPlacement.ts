import type { ActiveFarm } from "../../shared/types";
import { farmBounds, MAP_HEIGHT, TILE_SIZE } from "./mapData";
import type { WalkObstacle } from "./walkCollisions";

export interface PropPlacement {
	x: number;
	y: number;
	width: number;
	height: number;
	ground: WalkObstacle;
	reason: string | null;
}

export function snapPropAnchor(x: number, y: number): { x: number; y: number } {
	return { x: Math.round(x / 2) * 2, y: Math.round(y / 2) * 2 };
}

export function overlaps(a: WalkObstacle, b: WalkObstacle): boolean {
	return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
}

/** Paths and shoreline are legal; only the water row and actual ground-level
 * occupants are excluded. Art can overhang another object without blocking. */
export function propPlacementReason(
	placement: Omit<PropPlacement, "reason">,
	obstacles: WalkObstacle[],
	tiles: ActiveFarm["tiles"],
	player: { x: number; y: number },
	landLevel = 0,
): string | null {
	const { x, y, width, height, ground } = placement;
	const bounds = farmBounds(landLevel);
	if (x - width / 2 < bounds.minColumn * TILE_SIZE ||
		x + width / 2 > (bounds.maxColumn + 1) * TILE_SIZE ||
		y - height < bounds.minRow * TILE_SIZE ||
		ground.top < bounds.minRow * TILE_SIZE || ground.bottom > MAP_HEIGHT - TILE_SIZE)
		return "Keep the object on the farm, out of the water.";
	if (obstacles.some((box) => overlaps(ground, box)))
		return "Another object or fence occupies that space.";
	if (tiles.some((tile) => overlaps(ground, {
		left: tile.x * TILE_SIZE, right: (tile.x + 1) * TILE_SIZE,
		top: tile.y * TILE_SIZE, bottom: (tile.y + 1) * TILE_SIZE,
	}))) return "A crop or tilled tile occupies that space.";
	if (player.x > ground.left - 12 && player.x < ground.right + 12 &&
		player.y > ground.top - 12 && player.y < ground.bottom + 12)
		return "Move out of the placement area first.";
	return null;
}

export function footprintTileSpan(ground: WalkObstacle): { columns: number; rows: number } {
	return {
		columns: Math.ceil(ground.right / TILE_SIZE) - Math.floor(ground.left / TILE_SIZE),
		rows: Math.ceil(ground.bottom / TILE_SIZE) - Math.floor(ground.top / TILE_SIZE),
	};
}
