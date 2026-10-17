import * as ex from "excalibur";
import { CROPS, type CropId } from "../../shared/crops";
import { fenceResources } from "./fenceResources";
import { farmerImage } from "./farmerSprite";
import type { PropKey, TerrainKey } from "./mapData";

export const image = (path: string) =>
	new ex.ImageSource(`/assets/${path}`, {
		filtering: ex.ImageFiltering.Pixel,
	});

export const terrainImage = image("farm/terrain.webp");
export const trainImage = image("transport/starter-train.webp");

/** One image per growth stage of every registered crop. */
export const cropStageImages: Record<CropId, ex.ImageSource[]> = Object.fromEntries(
	(Object.keys(CROPS) as CropId[]).map((id) => [
		id,
		CROPS[id].stages.map((file) => image(`crops/${file}`)),
	]),
) as Record<CropId, ex.ImageSource[]>;

/** Harvested-produce icon per crop, used by the inventory and hotbar. */
export const cropHarvestedImages: Record<CropId, ex.ImageSource> = Object.fromEntries(
	(Object.keys(CROPS) as CropId[]).map((id) => [
		id,
		image(`crops/${CROPS[id].harvested}`),
	]),
) as Record<CropId, ex.ImageSource>;

export const scytheImages = {
	basic: image("tools/scythe_basic.webp"),
	iron: image("tools/scythe_iron.webp"),
	runed: image("tools/scythe_runed.webp"),
};

export const sweepFxImages = [
	image("tools/sweep_fx_0.webp"),
	image("tools/sweep_fx_1.webp"),
	image("tools/sweep_fx_2.webp"),
];

export const propImages: Record<PropKey, ex.ImageSource> = {
	farmhouse: image("farm/buildings/farmhouse.webp"),
	barn: image("farm/buildings/barn.webp"),
	"oak-tree": image("farm/plants/oak-tree.webp"),
	"pine-tree": image("farm/plants/pine-tree.webp"),
	"apple-tree": image("farm/plants/apple-tree.webp"),
	well: image("farm/objects/well.webp"),
	bench: image("farm/objects/bench.webp"),
	sign: image("farm/objects/sign.webp"),
	barrel: image("farm/objects/barrel.webp"),
	crate: image("farm/objects/crate.webp"),
	daisies: image("farm/plants/daisies.webp"),
	marigolds: image("farm/plants/marigolds.webp"),
	"blue-flowers": image("farm/plants/blue-flowers.webp"),
	"starter-train": trainImage,
};

export const resources = [
	terrainImage,
	...fenceResources,
	farmerImage,
	...Object.values(propImages),
	...Object.values(cropStageImages).flat(),
	...Object.values(cropHarvestedImages),
	...Object.values(scytheImages),
	...sweepFxImages,
];

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
