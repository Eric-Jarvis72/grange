import * as ex from "excalibur";
import {
	FARM_WORLD_MAX_COLUMN,
	FARM_WORLD_MAX_ROW,
	FARM_WORLD_MIN_COLUMN,
	FARM_WORLD_MIN_ROW,
	farmBounds,
	terrainAt,
	TILE_SIZE,
} from "./mapData";
import { terrainFrames, terrainImage } from "./resources";

/**
 * The scenic land is the full farm world. A canvas that fills a wide browser
 * shows it while the camera scrolls; the normal tint marks the part of it the
 * player has bought.
 */
export const FARM_SCENIC_MIN_COLUMN = FARM_WORLD_MIN_COLUMN;
export const FARM_SCENIC_MAX_COLUMN = FARM_WORLD_MAX_COLUMN;
export const FARM_SCENIC_MIN_ROW = FARM_WORLD_MIN_ROW;
export const FARM_SCENIC_MAX_ROW = FARM_WORLD_MAX_ROW;

/** Wild land outside the owned plot is dimmed so the boundary still reads. */
const WILD_TINT = ex.Color.fromHex("#b4bfa2");

export interface FarmTerrain {
	sheet: ex.SpriteSheet;
	tileMap: ex.TileMap;
}

/** The tile map has room for the farm, every land purchase, and scenic land. */
export function buildTerrain(level = 0): FarmTerrain {
	const sheet = ex.SpriteSheet.fromImageSource({
		image: terrainImage,
		grid: { rows: 4, columns: 4, spriteWidth: TILE_SIZE, spriteHeight: TILE_SIZE },
	});
	const tileMap = new ex.TileMap({
		pos: ex.vec(
			FARM_SCENIC_MIN_COLUMN * TILE_SIZE,
			FARM_SCENIC_MIN_ROW * TILE_SIZE,
		),
		tileWidth: TILE_SIZE,
		tileHeight: TILE_SIZE,
		columns: FARM_SCENIC_MAX_COLUMN - FARM_SCENIC_MIN_COLUMN + 1,
		rows: FARM_SCENIC_MAX_ROW - FARM_SCENIC_MIN_ROW + 1,
		renderFromTopOfGraphic: true,
	});
	paintFarmTerrain(tileMap, sheet, level);
	return { sheet, tileMap };
}

export function farmTerrainTile(
	terrain: ex.TileMap,
	column: number,
	row: number,
) {
	return terrain.getTile(
		column - FARM_SCENIC_MIN_COLUMN,
		row - FARM_SCENIC_MIN_ROW,
	);
}

export function paintFarmTerrain(
	terrain: ex.TileMap,
	sheet: ex.SpriteSheet,
	level: number,
): void {
	const bounds = farmBounds(level);
	for (let row = FARM_SCENIC_MIN_ROW; row <= FARM_SCENIC_MAX_ROW; row += 1) {
		for (
			let column = FARM_SCENIC_MIN_COLUMN;
			column <= FARM_SCENIC_MAX_COLUMN;
			column += 1
		) {
			const tile = farmTerrainTile(terrain, column, row);
			tile?.clearGraphics();
			const frame = terrainFrames[terrainAt(column, row)];
			const sprite = sheet.getSprite(frame.column, frame.row);
			const owned =
				column >= bounds.minColumn &&
				column <= bounds.maxColumn &&
				row >= bounds.minRow;
			if (!owned) sprite.tint = WILD_TINT;
			tile?.addGraphic(sprite);
		}
	}
}
