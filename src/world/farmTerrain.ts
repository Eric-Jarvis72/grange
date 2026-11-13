import * as ex from "excalibur";
import { farmBounds, terrainAt, TILE_SIZE } from "./mapData";
import { terrainFrames, terrainImage } from "./resources";

export const FARM_MIN_COLUMN = -2;
export const FARM_MIN_ROW = -4;

export interface FarmTerrain {
	sheet: ex.SpriteSheet;
	tileMap: ex.TileMap;
}

/** The tile map has room for every land purchase; unowned tiles stay blank. */
export function buildTerrain(level = 0): FarmTerrain {
	const sheet = ex.SpriteSheet.fromImageSource({
		image: terrainImage,
		grid: { rows: 4, columns: 4, spriteWidth: TILE_SIZE, spriteHeight: TILE_SIZE },
	});
	const tileMap = new ex.TileMap({
		pos: ex.vec(FARM_MIN_COLUMN * TILE_SIZE, FARM_MIN_ROW * TILE_SIZE),
		tileWidth: TILE_SIZE,
		tileHeight: TILE_SIZE,
		columns: 22,
		rows: 16,
		renderFromTopOfGraphic: true,
	});
	paintFarmTerrain(tileMap, sheet, level);
	return { sheet, tileMap };
}

export function farmTerrainTile(terrain: ex.TileMap, column: number, row: number) {
	return terrain.getTile(column - FARM_MIN_COLUMN, row - FARM_MIN_ROW);
}

export function paintFarmTerrain(terrain: ex.TileMap, sheet: ex.SpriteSheet, level: number): void {
	const bounds = farmBounds(level);
	for (let row = FARM_MIN_ROW; row <= 11; row += 1) {
		for (let column = FARM_MIN_COLUMN; column <= 19; column += 1) {
			const tile = farmTerrainTile(terrain, column, row);
			tile?.clearGraphics();
			if (column < bounds.minColumn || column > bounds.maxColumn || row < bounds.minRow) continue;
			const frame = terrainFrames[terrainAt(column, row)];
			tile?.addGraphic(sheet.getSprite(frame.column, frame.row));
		}
	}
}
