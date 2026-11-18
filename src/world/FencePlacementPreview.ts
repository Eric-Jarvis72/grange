import * as ex from "excalibur";
import type { ActiveFarm } from "../../shared/types";
import type { BlockRegistry } from "./blocking";
import { fencePlacementReason } from "./fenceActions";
import { actOnFence } from "./fenceActions";
import { fenceImages } from "./fenceResources";
import { TILE_SIZE } from "./mapData";

export const fenceCornerAt = (pos: { x: number; y: number }) => ({
	column: Math.round(pos.x / TILE_SIZE), row: Math.round(pos.y / TILE_SIZE),
});

/** One-tile placement preview, using the same validity check as the actual action. */
export class FencePlacementPreview {
	private tile: ex.Actor | null = null;
	private post: ex.Actor | null = null;
	private graphic: ex.Canvas | null = null;
	private reason: string | null = null;

	constructor(private scene: ex.Scene) {}

	get active(): boolean { return this.tile !== null; }

	start(pos: ex.Vector, farm: ActiveFarm, blocks: BlockRegistry,
		player: { x: number; y: number }): void {
		this.clear();
		this.tile = new ex.Actor({ anchor: ex.vec(0, 0), z: 3002 });
		this.graphic = new ex.Canvas({ width: 28, height: 28, draw: (ctx) => {
			const valid = !this.reason;
			ctx.fillStyle = valid ? "rgba(49, 210, 89, 0.5)" : "rgba(240, 55, 55, 0.56)";
			ctx.fillRect(0, 0, 28, 28);
			ctx.strokeStyle = valid ? "#b4ffae" : "#ffb2a8";
			ctx.lineWidth = 3;
			ctx.strokeRect(1.5, 1.5, 25, 25);
		} });
		this.tile.graphics.use(this.graphic);
		const sprite = fenceImages.post.toSprite();
		sprite.scale = ex.vec(0.4, 0.4);
		this.post = new ex.Actor({ anchor: ex.vec(120 / 250, 190 / 220), z: 3001 });
		this.post.graphics.use(sprite);
		this.post.graphics.opacity = 0.55;
		this.scene.add(this.tile);
		this.scene.add(this.post);
		this.update(pos, farm, blocks, player);
	}

	update(pos: ex.Vector, farm: ActiveFarm, blocks: BlockRegistry,
		player: { x: number; y: number }): { column: number; row: number; reason: string | null } {
		const { column, row } = fenceCornerAt(pos);
		this.reason = fencePlacementReason(farm, column, row, blocks, player);
		if (this.tile && this.post) {
			this.tile.pos = ex.vec(column * TILE_SIZE - 14, row * TILE_SIZE - 14);
			this.post.pos = ex.vec(column * TILE_SIZE, row * TILE_SIZE);
			this.graphic?.flagDirty();
		}
		return { column, row, reason: this.reason };
	}

	finish(pos: ex.Vector, farm: ActiveFarm, blocks: BlockRegistry,
		player: { x: number; y: number }): { column: number; row: number; reason: string | null } {
		const result = this.update(pos, farm, blocks, player);
		this.clear();
		return result;
	}

	release(pos: ex.Vector, farm: ActiveFarm, blocks: BlockRegistry,
		player: { x: number; y: number }, owner: string,
		report: (message: string) => void): void {
		const result = this.finish(pos, farm, blocks, player);
		if (result.reason) report(result.reason);
		else actOnFence(owner, result.column, result.row, "fence", blocks, player, report);
	}

	clear(): void {
		if (this.tile) this.scene.remove(this.tile);
		if (this.post) this.scene.remove(this.post);
		this.tile = null;
		this.post = null;
		this.graphic = null;
		this.reason = null;
	}
}
