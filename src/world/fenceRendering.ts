import * as ex from "excalibur";
import type { FenceGate } from "../../shared/types";
import type { BlockRegistry } from "./blocking";
import {
	edgeKey,
	type FenceCoord,
	fenceGraph,
	gatedEdgeFor,
	gateSpriteOrientation,
} from "./fenceData";
import { fenceGateImages, fenceImages } from "./fenceResources";
import { setFarmFenceObstacles } from "./sceneObstacles";

const POST_SCALE = 0.4;
const POST_ANCHOR = { x: 120 / 250, y: 190 / 220 };
const RAIL_OVERLAP = 11;

/** Hinge-post centers measured from the prepared gate crops. */
const GATE_ANCHORS = {
	"closed-horizontal": { x: 138 / 300, y: 175 / 249 },
	"open-horizontal": { x: 141 / 310, y: 175 / 249 },
	"closed-vertical": { x: 24 / 48, y: 162 / 182 },
	"open-vertical": { x: 162 / 182, y: 24 / 48 },
} as const;

/** Screen-space lift so the vertical leaf sits at fence-rail height. */
const GATE_VISUAL_OFFSETS = {
	"closed-horizontal": 0,
	"open-horizontal": 0,
	"closed-vertical": -3,
	"open-vertical": -20,
} as const;

/**
 * The south-pointing closed leaf is the north art mirrored, which puts its
 * hinge slightly below the top post. Extra lift tucks the hinge onto the post.
 */
const SOUTH_CLOSED_VERTICAL_LIFT = -10;

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

	set(coords: FenceCoord[], gates: FenceGate[] = []): void {
		const signature = JSON.stringify({
			fences: coords.map(({ x, y }) => `${x},${y}`).sort(),
			gates: gates
				.map(({ x, y, direction, open }) => `${x},${y},${direction},${open}`)
				.sort(),
		});
		if (signature === this.signature) return;
		this.signature = signature;
		for (const actor of this.actors) this.scene.remove(actor);
		this.actors = [];
		const { nodes, edges } = fenceGraph(coords, gates);
		const nodeByKey = new Map(nodes.map((node) => [`${node.x},${node.y}`, node]));
		const gated = new Set<string>();
		const flips = new Map<string, boolean>();
		const raisedPosts = new Map<string, number>();
		for (const gate of gates) {
			const target = gatedEdgeFor(gate, edges);
			if (!target) continue;
			gated.add(edgeKey(target.edge));
			flips.set(`${gate.x},${gate.y}`, target.flipped);
			if (gate.direction !== "vertical") continue;
			const gateNode = nodeByKey.get(`${gate.x},${gate.y}`);
			if (!gateNode) continue;
			const far = target.edge.from.x === gate.x && target.edge.from.y === gate.y
				? target.edge.to
				: target.edge.from;
			// The post the leaf points toward draws over the leaf tip.
			if (far.worldY >= gateNode.worldY) continue;
			const key = `${far.x},${far.y}`;
			raisedPosts.set(key, Math.max(raisedPosts.get(key) ?? 0, 102 + gateNode.worldY));
		}
		for (const edge of edges) {
			if (gated.has(edgeKey(edge))) continue;
			if (edge.direction === "horizontal") {
				this.actors.push(rail(this.scene, fenceImages["rail-horizontal"],
					edge.from.worldX - RAIL_OVERLAP, edge.from.worldY - 37,
					edge.to.worldX - edge.from.worldX + RAIL_OVERLAP * 2, 33,
					120 + edge.from.worldY));
			} else {
				this.actors.push(rail(this.scene, fenceImages["rail-vertical"],
					edge.from.worldX - 14, edge.from.worldY - RAIL_OVERLAP, 28,
					edge.to.worldY - edge.from.worldY + RAIL_OVERLAP - 3,
					155 + edge.from.worldY));
			}
		}
		const gateByKey = new Map(gates.map((gate) => [`${gate.x},${gate.y}`, gate]));
		for (const node of nodes) {
			const gate = gateByKey.get(`${node.x},${node.y}`);
			if (gate && gate.direction !== "vertical") continue;
			const sprite = fenceImages.post.toSprite();
			sprite.scale = ex.vec(POST_SCALE, POST_SCALE);
			// The pivot post of a vertical gate sits in front of the leaf so the
			// hinge tucks behind it.
			const baseZ = gate?.direction === "vertical" ? 102 + node.worldY : 100 + node.worldY;
			const z = Math.max(raisedPosts.get(`${node.x},${node.y}`) ?? baseZ, baseZ);
			const actor = new ex.Actor({ pos: ex.vec(node.worldX, node.worldY),
				anchor: ex.vec(POST_ANCHOR.x, POST_ANCHOR.y), z });
			actor.graphics.use(sprite);
			this.scene.add(actor);
			this.actors.push(actor);
		}
		for (const gate of gates) {
			const node = nodes.find((candidate) => candidate.x === gate.x && candidate.y === gate.y);
			if (!node) continue;
			const key = `${gate.open ? "open" : "closed"}-${gate.direction}` as keyof typeof GATE_ANCHORS;
			const source = fenceGateImages[key];
			const sprite = source.toSprite();
			sprite.scale = ex.vec(POST_SCALE, POST_SCALE);
			const flipped = flips.get(`${gate.x},${gate.y}`) ?? false;
			const orientation = gateSpriteOrientation(gate, flipped);
			if (orientation.flipHorizontal) sprite.flipHorizontal = true;
			if (orientation.flipVertical) sprite.flipVertical = true;
			const anchor = GATE_ANCHORS[key];
			const visualOffset = GATE_VISUAL_OFFSETS[key]
				+ (key === "closed-vertical" && orientation.flipVertical ? SOUTH_CLOSED_VERTICAL_LIFT : 0);
			const actor = new ex.Actor({
				pos: ex.vec(node.worldX, node.worldY + visualOffset),
				anchor: ex.vec(
					orientation.flipHorizontal ? 1 - anchor.x : anchor.x,
					orientation.flipVertical ? 1 - anchor.y : anchor.y,
				),
				z: 101 + node.worldY,
			});
			actor.graphics.use(sprite);
			this.scene.add(actor);
			this.actors.push(actor);
		}
		// Rails/posts block walking in world space, not farming entire ground tiles.
		this.blocks.remove("field-fence");
		setFarmFenceObstacles(coords, gates);
	}
}
