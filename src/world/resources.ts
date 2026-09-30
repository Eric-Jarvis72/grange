import * as ex from "excalibur";
import type { PropKey, TerrainKey } from "./mapData";

const image = (path: string) =>
	new ex.ImageSource(`/assets/farm/${path}`, {
		filtering: ex.ImageFiltering.Pixel,
	});

export const terrainImage = image("terrain.webp");

export const propImages: Record<PropKey, ex.ImageSource> = {
	farmhouse: image("buildings/farmhouse.webp"),
	barn: image("buildings/barn.webp"),
	"oak-tree": image("plants/oak-tree.webp"),
	"pine-tree": image("plants/pine-tree.webp"),
	"apple-tree": image("plants/apple-tree.webp"),
	well: image("objects/well.webp"),
	bench: image("objects/bench.webp"),
	sign: image("objects/sign.webp"),
	barrel: image("objects/barrel.webp"),
	crate: image("objects/crate.webp"),
	"fence-horizontal": image("objects/fence-horizontal.webp"),
	"fence-post": image("objects/fence-post.webp"),
	daisies: image("plants/daisies.webp"),
	marigolds: image("plants/marigolds.webp"),
	"blue-flowers": image("plants/blue-flowers.webp"),
};

export const resources = [terrainImage, ...Object.values(propImages)];

export const terrainFrames: Record<
	TerrainKey,
	{ column: number; row: number }
> = {
	grass: { column: 0, row: 0 },
	"grass-tufts": { column: 1, row: 0 },
	"grass-flowers": { column: 2, row: 0 },
	"path-horizontal": { column: 0, row: 1 },
	"path-vertical": { column: 1, row: 1 },
	"path-cross": { column: 2, row: 1 },
	"tilled-dry": { column: 3, row: 2 },
	"shore-north": { column: 1, row: 3 },
	water: { column: 0, row: 3 },
	"tilled-watered": { column: 3, row: 3 },
};
