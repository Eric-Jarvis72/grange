import * as ex from "excalibur";
import { MAP_COLUMNS, MAP_ROWS, TILE_SIZE, terrainAt } from "./mapData";
import { terrainFrames, terrainImage } from "./resources";

export interface FarmTerrain {
	sheet: ex.SpriteSheet;
	tileMap: ex.TileMap;
}

/**
 * Builds the static farm ground: a sprite sheet of terrain tiles plus the
 * tile map laid out from `terrainAt`. Kept out of `FarmMapScene` so the scene
 * stays focused on gameplay wiring.
 */
export function buildTerrain(): FarmTerrain {
	const sheet = ex.SpriteSheet.fromImageSource({
		image: terrainImage,
		grid: {
			rows: 4,
			columns: 4,
			spriteWidth: TILE_SIZE,
			spriteHeight: TILE_SIZE,
		},
	});

	const tileMap = new ex.TileMap({
		pos: ex.vec(0, 0),
		tileWidth: TILE_SIZE,
		tileHeight: TILE_SIZE,
		columns: MAP_COLUMNS,
		rows: MAP_ROWS,
		renderFromTopOfGraphic: true,
	});

	for (let row = 0; row < MAP_ROWS; row += 1) {
		for (let column = 0; column < MAP_COLUMNS; column += 1) {
			const frame = terrainFrames[terrainAt(column, row)];
			tileMap
				.getTile(column, row)
				?.addGraphic(sheet.getSprite(frame.column, frame.row));
		}
	}

	return { sheet, tileMap };
}
