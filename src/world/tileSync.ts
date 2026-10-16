import type * as ex from "excalibur";
import type { CropLayer, CropTileView } from "./cropLayer";
import type { MapProp } from "./mapData";
import { terrainAt } from "./mapData";
import { terrainFrames } from "./resources";

/** Removes tilled-over decor (flowers) on a tile. Returns the removed
 * asset keys so a future pickup feature can credit them to inventory. */
export function clearDecorAt(
	decor: Map<string, number[]>,
	propActors: Array<ex.Actor | undefined>,
	props: MapProp[],
	strokeKey: string,
): string[] {
	const indices = decor.get(strokeKey);
	if (!indices) return [];
	decor.delete(strokeKey);
	const cleared: string[] = [];
	for (const index of indices) {
		propActors[index]?.kill();
		propActors[index] = undefined;
		cleared.push(props[index].asset);
	}
	return cleared;
}

export function refreshTile(
	terrain: ex.TileMap,
	sheet: ex.SpriteSheet,
	crops: CropLayer,
	column: number,
	row: number,
	tile: CropTileView | undefined,
): void {
	const mapTile = terrain.getTile(column, row);
	if (!mapTile) return;
	const state = tile?.state;
	mapTile.clearGraphics();
	if (!state) {
		const frame = terrainFrames[terrainAt(column, row)];
		mapTile.addGraphic(sheet.getSprite(frame.column, frame.row));
	} else {
		const soil =
			state === "planted" || state === "tilled"
				? "tilled-dry"
				: "tilled-watered";
		const frame = terrainFrames[soil];
		mapTile.addGraphic(sheet.getSprite(frame.column, frame.row));
	}
	crops.sync(column, row, tile);
}
