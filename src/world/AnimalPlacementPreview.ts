import * as ex from "excalibur";
import type { ActiveFarm } from "../../shared/types";
import type { BlockRegistry } from "./blocking";
import { animalPlacementReason, placeAnimal } from "./animalPlacement";
import type { AnimalId } from "./livestockData";
import { livestockAnimalImages } from "./livestockResources";
import { TILE_SIZE } from "./mapData";

/** Hold, drag, and release livestock on a clear owned farm tile. */
export class AnimalPlacementPreview {
	private tile: ex.Actor | null = null;
	private ghost: ex.Actor | null = null;
	private graphic: ex.Canvas | null = null;
	private reason: string | null = null;
	private animal: AnimalId | null = null;

	constructor(private readonly scene: ex.Scene) {}
	get active(): boolean { return this.tile !== null; }
	get selectedAnimal(): AnimalId | null { return this.animal; }

	start(animal: AnimalId, pos: ex.Vector, farm: ActiveFarm, blocks: BlockRegistry,
		player: { x: number; y: number }): void {
		this.clear();
		this.animal = animal;
		this.tile = new ex.Actor({ anchor: ex.vec(0, 0), z: 3002 });
		this.graphic = new ex.Canvas({ width: TILE_SIZE, height: TILE_SIZE, draw: (ctx) => {
			ctx.fillStyle = this.reason ? "rgba(240, 55, 55, 0.48)" : "rgba(49, 210, 89, 0.45)";
			ctx.fillRect(0, 0, TILE_SIZE, TILE_SIZE);
			ctx.strokeStyle = this.reason ? "#ffb2a8" : "#b4ffae";
			ctx.lineWidth = 3;
			ctx.strokeRect(1.5, 1.5, TILE_SIZE - 3, TILE_SIZE - 3);
		} });
		this.tile.graphics.use(this.graphic);
		const source = livestockAnimalImages[animal];
		const sprite = source.toSprite();
		const scale = (animal === "hen" ? 48 : 58) / source.width;
		sprite.scale = ex.vec(scale, scale);
		this.ghost = new ex.Actor({ anchor: ex.vec(0.5, 1), z: 3001 });
		this.ghost.graphics.use(sprite);
		this.ghost.graphics.opacity = 0.65;
		this.scene.add(this.tile);
		this.scene.add(this.ghost);
		this.update(pos, farm, blocks, player);
	}

	update(pos: ex.Vector, farm: ActiveFarm, blocks: BlockRegistry,
		player: { x: number; y: number }) {
		const x = Math.floor(pos.x / TILE_SIZE);
		const y = Math.floor(pos.y / TILE_SIZE);
		this.reason = this.animal
			? animalPlacementReason(farm, this.animal, x, y, blocks, player)
			: "Select an animal first.";
		if (this.tile && this.ghost) {
			this.tile.pos = ex.vec(x * TILE_SIZE, y * TILE_SIZE);
			this.ghost.pos = ex.vec(x * TILE_SIZE + 32, y * TILE_SIZE + 40);
			this.graphic?.flagDirty();
		}
		return { x, y, reason: this.reason };
	}

	release(pos: ex.Vector, farm: ActiveFarm, blocks: BlockRegistry,
		player: { x: number; y: number }, owner: string, report: (text: string) => void): void {
		const result = this.update(pos, farm, blocks, player);
		const animal = this.animal;
		this.clear();
		if (result.reason) report(result.reason);
		else if (animal) placeAnimal(owner, animal, result.x, result.y, report);
	}

	clear(): void {
		if (this.tile) this.scene.remove(this.tile);
		if (this.ghost) this.scene.remove(this.ghost);
		this.tile = null;
		this.ghost = null;
		this.graphic = null;
		this.reason = null;
		this.animal = null;
	}
}
