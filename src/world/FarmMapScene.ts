import * as ex from "excalibur";
import {
	MAP_COLUMNS,
	MAP_HEIGHT,
	MAP_ROWS,
	MAP_WIDTH,
	TILE_SIZE,
	props,
	terrainAt,
} from "./mapData";
import { propImages, terrainFrames, terrainImage } from "./resources";

/** A render-only scene: no input, physics, state, or gameplay systems. */
export class FarmMapScene extends ex.Scene {
	override onInitialize(): void {
		this.backgroundColor = ex.Color.fromHex("#79a44d");

		const sheet = ex.SpriteSheet.fromImageSource({
			image: terrainImage,
			grid: {
				rows: 4,
				columns: 4,
				spriteWidth: TILE_SIZE,
				spriteHeight: TILE_SIZE,
			},
		});
		const terrain = new ex.TileMap({
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
				terrain
					.getTile(column, row)
					?.addGraphic(sheet.getSprite(frame.column, frame.row));
			}
		}
		this.add(terrain);

		for (const prop of props) {
			const source = propImages[prop.asset];
			const sprite = source.toSprite();
			const scale = prop.width / source.width;
			sprite.scale = ex.vec(scale, scale);
			const actor = new ex.Actor({
				pos: ex.vec(prop.x, prop.y),
				anchor: ex.vec(0.5, 1),
				z: 100 + Math.floor(prop.y),
			});
			actor.graphics.use(sprite);
			this.add(actor);
		}

		this.camera.pos = ex.vec(MAP_WIDTH / 2, MAP_HEIGHT / 2);
	}
}
