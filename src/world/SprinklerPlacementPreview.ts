import * as ex from "excalibur";
import type { ActiveFarm } from "../../shared/types";
import { TILE_SIZE } from "./mapData";
import { actOnSprinkler, sprinklerPlacementReason } from "./sprinklerActions";
import { sprinklerAnchorAt, sprinklerCorner } from "./sprinklerData";
import { sprinklerImage } from "./sprinklerResources";

const FOOT = TILE_SIZE * 2;

/** Drag preview that snaps to a tile corner and highlights the covered 2x2. */
export class SprinklerPlacementPreview {
	private grid: ex.Actor | null = null;
	private ghost: ex.Actor | null = null;
	private graphic: ex.Canvas | null = null;
	private reason: string | null = null;

	constructor(private readonly scene: ex.Scene) {}

	get active(): boolean {
		return this.grid !== null;
	}

	start(pos: ex.Vector, farm: ActiveFarm): void {
		this.clear();
		this.grid = new ex.Actor({ anchor: ex.vec(0, 0), z: 3002 });
		this.graphic = new ex.Canvas({
			width: FOOT,
			height: FOOT,
			draw: (ctx) => {
				const valid = !this.reason;
				ctx.fillStyle = valid
					? "rgba(49, 210, 89, 0.32)"
					: "rgba(240, 55, 55, 0.4)";
				ctx.fillRect(0, 0, FOOT, FOOT);
				ctx.strokeStyle = valid ? "#b4ffae" : "#ffb2a8";
				ctx.lineWidth = 3;
				for (let i = 0; i <= 2; i += 1) {
					ctx.beginPath();
					ctx.moveTo(i * TILE_SIZE, 0);
					ctx.lineTo(i * TILE_SIZE, FOOT);
					ctx.moveTo(0, i * TILE_SIZE);
					ctx.lineTo(FOOT, i * TILE_SIZE);
					ctx.stroke();
				}
				ctx.fillStyle = "#fff";
				ctx.font = "bold 14px sans-serif";
				ctx.fillText("2 × 2", 8, 19);
			},
		});
		this.grid.graphics.use(this.graphic);
		const sprite = sprinklerImage.toSprite();
		const scale = 56 / sprinklerImage.width;
		sprite.scale = ex.vec(scale, scale);
		this.ghost = new ex.Actor({ anchor: ex.vec(0.5, 0.5), z: 3001 });
		this.ghost.graphics.use(sprite);
		this.ghost.graphics.opacity = 0.6;
		this.scene.add(this.grid);
		this.scene.add(this.ghost);
		this.update(pos, farm);
	}

	update(
		pos: ex.Vector,
		farm: ActiveFarm,
	): { x: number; y: number; reason: string | null } {
		const coord = sprinklerAnchorAt(pos.x, pos.y);
		this.reason = sprinklerPlacementReason(farm, coord.x, coord.y);
		if (this.grid && this.ghost) {
			this.grid.pos = ex.vec(coord.x * TILE_SIZE, coord.y * TILE_SIZE);
			const corner = sprinklerCorner(coord.x, coord.y);
			this.ghost.pos = ex.vec(corner.x, corner.y);
			this.graphic?.flagDirty();
		}
		return { ...coord, reason: this.reason };
	}

	finish(
		pos: ex.Vector,
		farm: ActiveFarm,
	): { x: number; y: number; reason: string | null } {
		const result = this.update(pos, farm);
		this.clear();
		return result;
	}

	release(
		pos: ex.Vector,
		farm: ActiveFarm,
		owner: string,
		report: (message: string) => void,
	): void {
		const result = this.finish(pos, farm);
		if (result.reason) report(result.reason);
		else actOnSprinkler(owner, result.x, result.y, "sprinkler", report);
	}

	clear(): void {
		if (this.grid) this.scene.remove(this.grid);
		if (this.ghost) this.scene.remove(this.ghost);
		this.grid = null;
		this.ghost = null;
		this.graphic = null;
		this.reason = null;
	}
}
