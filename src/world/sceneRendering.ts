import * as ex from "excalibur";
import {
	ANIMATED_PROPS,
	MAP_COLUMNS,
	MAP_ROWS,
	type TerrainKey,
	TILE_SIZE,
} from "./mapData";
import { terrainFrames, terrainImage } from "./resources";

export interface RenderedProp<Asset extends string> {
	asset: Asset;
	x: number;
	y: number;
	width: number;
}

export function addTerrain(
	scene: ex.Scene,
	terrainAt: (column: number, row: number) => TerrainKey,
	columns = MAP_COLUMNS,
	rows = MAP_ROWS,
): void {
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
		columns,
		rows,
		renderFromTopOfGraphic: true,
	});

	for (let row = 0; row < rows; row += 1) {
		for (let column = 0; column < columns; column += 1) {
			const frame = terrainFrames[terrainAt(column, row)];
			terrain
				.getTile(column, row)
				?.addGraphic(sheet.getSprite(frame.column, frame.row));
		}
	}
	scene.add(terrain);
}

/** Draws each prop's still sprite, skipping any the scene animates itself. */
export function addProps<Asset extends string>(
	scene: ex.Scene,
	props: RenderedProp<Asset>[],
	images: Record<Asset, ex.ImageSource>,
): void {
	for (const prop of props) {
		if (ANIMATED_PROPS.has(prop.asset)) continue;
		const source = images[prop.asset];
		const sprite = source.toSprite();
		const scale = prop.width / source.width;
		sprite.scale = ex.vec(scale, scale);
		const actor = new ex.Actor({
			pos: ex.vec(prop.x, prop.y),
			anchor: ex.vec(0.5, 1),
			z: 100 + Math.floor(prop.y),
		});
		actor.graphics.use(sprite);
		scene.add(actor);
	}
}
