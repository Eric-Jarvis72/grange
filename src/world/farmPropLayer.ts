import * as ex from "excalibur";
import type { ActiveFarm } from "../../shared/types";
import type { BlockRegistry, TileCoord } from "./blocking";
import { groundFootprintTiles, rectFootprintTiles } from "./blocking";
import { type PlacedFarmProp, placedFarmProps } from "./farmPropData";
import {
	ANIMATED_PROPS,
	type MovablePropKey,
	propBlocking,
	props,
} from "./mapData";
import { type PropPlacement, propPlacementReason } from "./propPlacement";
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

	placement(
		asset: MovablePropKey,
		x: number,
		y: number,
		player: { x: number; y: number },
		farm: ActiveFarm,
	): PropPlacement | null {
		const carried = farm.prop_overrides
			.filter((change) => change.carried && change.asset === asset)
			.sort((a, b) => a.index - b.index)[0];
		const original = carried ? props[carried.index] : props.find((prop) => prop.asset === asset);
		if (!original || original.asset !== asset) return null;
		const source = propImages[asset];
		const height = (source.height * original.width) / source.width;
		const ground = propObstacles(
			[{ ...original, x, y }],
			farmPlacementFootprints,
		)[0];
		if (!ground) return null;
		const placement = { x, y, width: original.width, height, ground };
		return { ...placement, reason: propPlacementReason(placement,
			farmPlacementObstacles, farm.tiles, player, farm.land_level) };
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
