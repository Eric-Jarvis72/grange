import * as ex from "excalibur";
import { type CropId, matureStage } from "../../shared/crops";
import { decodeCrop } from "../../shared/farm";
import { TILE_SIZE } from "./mapData";
import { cropStageImages } from "./resources";

/** The subset of a server tile the crop renderer needs. */
export interface CropTileView {
	state: "tilled" | "planted" | "watered" | "ready";
	crop?: string;
	planted_at?: number | null;
	watered_at?: number | null;
	ready_at?: number | null;
}

/**
 * Maps a server tile to a growth-stage index. Standard crops show 5 stages,
 * Midas Wheat / Frost-Crisp Lettuce 4, and Sun-Burst Tomato 3; intermediate
 * watered frames are interpolated from the tile's water/ready timestamps.
 */
export function serverStageIndex(tile: CropTileView, now: number): number {
	const { cropId } = decodeCrop(tile.crop);
	const mature = matureStage(cropId);
	if (tile.state === "planted") return 0;
	if (tile.state === "ready") return mature;
	if (tile.state === "watered") {
		const start = tile.watered_at ?? now;
		const end = tile.ready_at ?? start;
		const total = Math.max(1, end - start);
		const progress = Math.min(1, Math.max(0, (now - start) / total));
		return Math.min(mature, Math.round(progress * mature));
	}
	return -1;
}

interface PlantedCrop {
	actor: ex.Actor;
	cropId: CropId;
	stage: number;
}

/** Owns the crop sprites planted on tilled tiles. */
export class CropLayer {
	private readonly crops = new Map<string, PlantedCrop>();

	constructor(private readonly scene: ex.Scene) {}

	sync(
		column: number,
		row: number,
		tile: CropTileView | undefined,
		now: number = Date.now(),
	): void {
		const key = `${column},${row}`;
		const existing = this.crops.get(key);
		if (!tile || tile.state === "tilled") {
			existing?.actor.kill();
			this.crops.delete(key);
			return;
		}

		const { cropId } = decodeCrop(tile.crop);
		const stage = serverStageIndex(tile, now);
		if (existing && existing.cropId === cropId && existing.stage === stage) return;

		const source = cropStageImages[cropId][stage];
		const sprite = source.toSprite();
		const targetHeight = stage === matureStage(cropId) ? 52 : 30;
		const scale = targetHeight / source.height;
		sprite.scale = ex.vec(scale, scale);

		if (existing) {
			existing.actor.graphics.use(sprite);
			existing.cropId = cropId;
			existing.stage = stage;
			return;
		}

		const crop = new ex.Actor({
			pos: ex.vec(
				column * TILE_SIZE + TILE_SIZE / 2,
				row * TILE_SIZE + TILE_SIZE - CropLayer.baseLift,
			),
			anchor: ex.vec(0.5, 1),
			z: 10 + row,
		});
		crop.graphics.use(sprite);
		this.scene.add(crop);
		this.crops.set(key, { actor: crop, cropId, stage });
	}

	private static readonly baseLift = 14;
}
