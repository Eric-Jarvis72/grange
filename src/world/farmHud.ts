import type { ActiveFarm } from "../../shared/types";
import { farmBounds, TILE_SIZE, terrainAt } from "./mapData";

export interface FarmHoveredTile {
	column: number;
	row: number;
	state: string;
}

export interface FarmHudSnapshot {
	tomatoes: number;
	message: string;
	hovered: FarmHoveredTile | null;
}

export function hoveredFarmTile(x: number, y: number,
	farm: ActiveFarm | null): FarmHoveredTile | null {
	const column = Math.floor(x / TILE_SIZE);
	const row = Math.floor(y / TILE_SIZE);
	const bounds = farmBounds(farm?.land_level ?? 0);
	if (column < bounds.minColumn || row < bounds.minRow ||
		column > bounds.maxColumn || row > bounds.maxRow) return null;
	const stored = farm?.tiles.find((tile) => tile.x === column && tile.y === row);
	return { column, row, state: stored?.state ?? terrainAt(column, row) };
}
