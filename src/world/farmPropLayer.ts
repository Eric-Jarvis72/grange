import * as ex from "excalibur";
import type { ActiveFarm } from "../../shared/types";
import type { BlockRegistry, TileCoord } from "./blocking";
import { groundFootprintTiles, rectFootprintTiles } from "./blocking";
import { type PlacedFarmProp, placedFarmProps } from "./farmPropData";
import {
	ANIMATED_PROPS,
	MAP_HEIGHT,
	MAP_WIDTH,
	type MovablePropKey,
	propBlocking,
	TILE_SIZE,
} from "./mapData";
import { propImages } from "./resources";
import {
	farmPlacementFootprints,
	farmPlacementObstacles,
	setFarmPropObstacles,
} from "./sceneObstacles";
import { propObstacles } from "./walkCollisions";

interface Rendered {
	prop: PlacedFarmProp;
	actor: ex.Actor | null;
	height: number;
}

export class FarmPropLayer {
	private rendered: Rendered[] = [];
	private signature: string | null = null;

	constructor(
		private scene: ex.Scene,
		private blocks: BlockRegistry,
	) {}

	set(overrides: ActiveFarm["prop_overrides"]): void {
		const signature = JSON.stringify(overrides);
		if (signature === this.signature) return;
		this.signature = signature;
		for (const { prop, actor } of this.rendered) {
			if (actor) this.scene.remove(actor);
			this.blocks.remove(`prop-${prop.index}`);
		}
		this.rendered = [];
		const placed = placedFarmProps(overrides);
		for (const prop of placed) {
			const source = propImages[prop.asset];
			const scale = prop.width / source.width;
			const height = source.height * scale;
			this.blocks.add(`prop-${prop.index}`, this.footprint(prop, height));
			// The scene animates the train itself (TrainController), so skip
			// drawing a still copy that would be left behind when it departs —
			// but keep its footprint and click area.
			if (ANIMATED_PROPS.has(prop.asset)) {
				this.rendered.push({ prop, actor: null, height });
				continue;
			}
			const sprite = source.toSprite();
			sprite.scale = ex.vec(scale, scale);
			const actor = new ex.Actor({
				pos: ex.vec(prop.x, prop.y),
				anchor: ex.vec(0.5, 1),
				z: 100 + Math.floor(prop.y),
			});
			actor.graphics.use(sprite);
			this.scene.add(actor);
			this.rendered.push({ prop, actor, height });
		}
		setFarmPropObstacles(placed);
	}

	/** Select the visually topmost prop whose sprite contains the click. */
	pick(x: number, y: number): PlacedFarmProp | null {
		return (
			[...this.rendered]
				.filter(
					({ prop, height }) =>
						x >= prop.x - prop.width / 2 &&
						x <= prop.x + prop.width / 2 &&
						y >= prop.y - height &&
						y <= prop.y,
				)
				.sort((a, b) => b.prop.y - a.prop.y)[0]?.prop ?? null
		);
	}

	canPlace(
		asset: MovablePropKey,
		x: number,
		y: number,
		player: { x: number; y: number },
		farm: ActiveFarm,
	): boolean {
		const original = placedFarmProps([]).find((prop) => prop.asset === asset);
		if (!original) return false;
		const source = propImages[asset];
		const height = (source.height * original.width) / source.width;
		if (
			x - original.width / 2 < 0 ||
			x + original.width / 2 > MAP_WIDTH ||
			y - height < 0 ||
			y > MAP_HEIGHT - 128
		)
			return false;
		const candidate = propObstacles(
			[{ ...original, x, y }],
			farmPlacementFootprints,
		)[0];
		if (!candidate) return false;
		const overlaps = (box: typeof candidate) =>
			candidate.left < box.right &&
			candidate.right > box.left &&
			candidate.top < box.bottom &&
			candidate.bottom > box.top;
		if (farmPlacementObstacles.some(overlaps)) return false;
		if (
			player.x >= candidate.left - 12 &&
			player.x <= candidate.right + 12 &&
			player.y >= candidate.top - 12 &&
			player.y <= candidate.bottom + 12
		)
			return false;
		return !farm.tiles.some((tile) =>
			overlaps({
				left: tile.x * TILE_SIZE,
				right: (tile.x + 1) * TILE_SIZE,
				top: tile.y * TILE_SIZE,
				bottom: (tile.y + 1) * TILE_SIZE,
			}),
		);
	}

	private footprint(prop: PlacedFarmProp, height: number): TileCoord[] {
		const rule = propBlocking[prop.asset];
		if (rule === "rect")
			return rectFootprintTiles(prop.x, prop.y, prop.width, height);
		if (rule === "base")
			return groundFootprintTiles(prop.x, prop.y, prop.width);
		return [];
	}
}
