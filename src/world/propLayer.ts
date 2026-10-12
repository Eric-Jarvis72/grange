import * as ex from "excalibur";
import {
	type BlockRegistry,
	groundFootprintTiles,
	rectFootprintTiles,
} from "./blocking";
import { propBlocking, props } from "./mapData";
import { propImages } from "./resources";

/**
 * Adds every farm prop to the scene and registers the tiles it blocks. Fences
 * use their full rect; buildings and upright props block only their base row.
 * Actor handles are stored per prop index so tilled-over decor can be removed.
 */
export function addFarmProps(
	scene: ex.Scene,
	blocks: BlockRegistry,
	propActors: Array<ex.Actor | undefined>,
): void {
	props.forEach((prop, index) => {
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
		scene.add(actor);
		propActors[index] = actor;

		const rule = propBlocking[prop.asset];
		if (rule === "rect") {
			blocks.add(
				`prop-${index}`,
				rectFootprintTiles(prop.x, prop.y, prop.width, source.height * scale),
			);
		} else if (rule === "base") {
			blocks.add(
				`prop-${index}`,
				groundFootprintTiles(prop.x, prop.y, prop.width),
			);
		}
	});
}
