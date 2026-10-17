import * as ex from "excalibur";
import type { BlockRegistry } from "./blocking";
import { buildFenceGraph, fenceBlockedTiles, type FenceCoord } from "./fenceData";
import { fenceImages } from "./fenceResources";
import { setFarmFenceObstacles } from "./sceneObstacles";

const POST_SCALE = 0.4;
const POST_ANCHOR = { x: 120 / 250, y: 190 / 220 };
const RAIL_OVERLAP = 11;

function rail(scene: ex.Scene, source: ex.ImageSource, x: number, y: number,
	width: number, height: number, z: number): ex.Actor {
	const sprite = source.toSprite();
	sprite.scale = ex.vec(width / source.width, height / source.height);
	const actor = new ex.Actor({ pos: ex.vec(x, y), anchor: ex.vec(0, 0), z });
	actor.graphics.use(sprite);
	scene.add(actor);
	return actor;
}

/** Rebuilds only the fence layer when the authoritative farm snapshot changes. */
export class FenceLayer {
	private actors: ex.Actor[] = [];
	private signature: string | null = null;

	constructor(private scene: ex.Scene, private blocks: BlockRegistry) {}

	set(coords: FenceCoord[]): void {
		const signature = coords.map(({ x, y }) => `${x},${y}`).sort().join("|");
		if (signature === this.signature) return;
		this.signature = signature;
		for (const actor of this.actors) this.scene.remove(actor);
		this.actors = [];
		const { nodes, edges } = buildFenceGraph(coords);
		for (const edge of edges) {
			if (edge.direction === "horizontal") {
				this.actors.push(rail(this.scene, fenceImages["rail-horizontal"],
					edge.from.worldX - RAIL_OVERLAP, edge.from.worldY - 37,
					edge.to.worldX - edge.from.worldX + RAIL_OVERLAP * 2, 33,
					80 + edge.from.worldY));
			} else {
				this.actors.push(rail(this.scene, fenceImages["rail-vertical"],
					edge.from.worldX - 14, edge.from.worldY - RAIL_OVERLAP, 28,
					edge.to.worldY - edge.from.worldY + RAIL_OVERLAP - 3,
					80 + edge.from.worldY));
			}
		}
		for (const node of nodes) {
			const sprite = fenceImages.post.toSprite();
			sprite.scale = ex.vec(POST_SCALE, POST_SCALE);
			const actor = new ex.Actor({ pos: ex.vec(node.worldX, node.worldY),
				anchor: ex.vec(POST_ANCHOR.x, POST_ANCHOR.y), z: 100 + node.worldY });
			actor.graphics.use(sprite);
			this.scene.add(actor);
			this.actors.push(actor);
		}
		this.blocks.add("field-fence", fenceBlockedTiles(coords));
		setFarmFenceObstacles(coords);
	}
}
