import * as ex from "excalibur";
import type { ActiveFarm } from "../../shared/types";
import { openStep } from "./animalPen";
import type { BlockRegistry } from "./blocking";
import type { AnimalId } from "./livestockData";
import { animalAnimationFrames } from "./livestockResources";
import { ownsFarmTile, TILE_SIZE } from "./mapData";

type AnimalPhase = keyof typeof animalAnimationFrames.hen;
type PlacedAnimal = NonNullable<ActiveFarm["placed_animals"]>[number];

interface AnimalState {
	actor: ex.Actor;
	home: PlacedAnimal;
	phase: AnimalPhase;
	elapsed: number;
	duration: number;
	target: ex.Vector | null;
	walkFrom: { x: number; y: number } | null;
	facingRight: boolean;
	painted: string;
}

// Keep the animal's feet away from the front rail of its ground tile.
const center = (x: number, y: number) => ex.vec(x * TILE_SIZE + 32, y * TILE_SIZE + 40);

/** Decorative local animation; the saved animal remains anchored to its placed tile. */
export class AnimalLayer {
	private animals: AnimalState[] = [];
	private signature = "";
	private farm: ActiveFarm | null = null;
	private blocks: BlockRegistry | null = null;

	constructor(private readonly scene: ex.Scene) {}

	set(farm: ActiveFarm | null, blocks: BlockRegistry): void {
		this.farm = farm;
		this.blocks = blocks;
		const placed = farm?.placed_animals ?? [];
		const signature = placed.map(({ id, species, x, y }) => `${id}:${species}:${x}:${y}`).join("|");
		if (signature === this.signature) return;
		this.signature = signature;
		for (const animal of this.animals) this.scene.remove(animal.actor);
		this.animals = placed.map((home: PlacedAnimal) => {
			const actor = new ex.Actor({ pos: center(home.x, home.y), anchor: ex.vec(0.5, 1) });
			this.scene.add(actor);
			const animal: AnimalState = {
				actor, home, phase: "idle", elapsed: 0, duration: 1200 + Math.random() * 1800,
				target: null, walkFrom: null, facingRight: false, painted: "",
			};
			this.paint(animal);
			return animal;
		});
	}

	/** Resolve a shovel click on a moving sprite to its persisted home tile. */
	at(pos: ex.Vector): PlacedAnimal | null {
		const animal = this.animals.find(({ actor, home }) => {
			const width = home.species === "hen" ? 48 : 58;
			return Math.abs(actor.pos.x - pos.x) < width / 2 &&
				pos.y >= actor.pos.y - width && pos.y <= actor.pos.y;
		});
		return animal?.home ?? null;
	}

	update(delta: number): void {
		for (const animal of this.animals) {
			if (animal.phase === "walk") this.move(animal, delta);
			else {
				animal.elapsed += delta;
				if (animal.elapsed >= animal.duration) this.nextPhase(animal);
			}
			animal.actor.z = 100 + animal.actor.pos.y;
			this.paint(animal);
		}
	}

	private nextPhase(animal: AnimalState): void {
		if (animal.phase !== "idle") {
			this.begin(animal, "idle", 1300 + Math.random() * 1900);
			return;
		}
		const choice = Math.random();
		if (choice < 0.5 && this.startWalk(animal)) return;
		this.begin(animal, choice < 0.78 ? "feed" : "rest", choice < 0.78 ? 1600 : 2600);
	}

	private startWalk(animal: AnimalState): boolean {
		const farm = this.farm;
		if (!farm || !this.blocks) return false;
		const currentX = Math.floor(animal.actor.pos.x / TILE_SIZE);
		const currentY = Math.floor(animal.actor.pos.y / TILE_SIZE);
		const directions = [[1, 0], [-1, 0], [0, 1], [0, -1]];
		const start = Math.floor(Math.random() * directions.length);
		for (let offset = 0; offset < directions.length; offset += 1) {
			const [dx, dy] = directions[(start + offset) % directions.length];
			const x = currentX + dx;
			const y = currentY + dy;
			if (!ownsFarmTile(x, y, farm.land_level ?? 0)) continue;
			if (Math.abs(x - animal.home.x) + Math.abs(y - animal.home.y) > 4) continue;
			if (!openStep(currentX, currentY, x, y, farm.fences ?? [], farm.gates ?? [])) continue;
			if (this.blocks.isBlocked(x, y) || farm.tiles.some((tile) => tile.x === x && tile.y === y)) continue;
			if (this.animals.some((other) => other !== animal && (
				(Math.floor(other.actor.pos.x / TILE_SIZE) === x &&
					Math.floor(other.actor.pos.y / TILE_SIZE) === y) ||
				(other.target !== null && Math.floor(other.target.x / TILE_SIZE) === x &&
					Math.floor(other.target.y / TILE_SIZE) === y)))) continue;
			animal.target = center(x, y);
			animal.walkFrom = { x: currentX, y: currentY };
			animal.facingRight = dx > 0;
			this.begin(animal, "walk", 0);
			return true;
		}
		// If fenced in or surrounded, the animal can still pace within its tile.
		if (!ownsFarmTile(currentX, currentY, farm.land_level ?? 0)) return false;
		animal.target = center(currentX, currentY).add(ex.vec(
			Math.round((Math.random() - 0.5) * 24), Math.round((Math.random() - 0.5) * 18),
		));
		animal.walkFrom = null;
		animal.facingRight = animal.target.x > animal.actor.pos.x;
		this.begin(animal, "walk", 0);
		return true;
	}

	private move(animal: AnimalState, delta: number): void {
		const target = animal.target;
		if (!target) {
			this.begin(animal, "idle", 1500);
			return;
		}
		// Fences/gates can change while an animal is already walking. Recheck the
		// planned crossing every frame, not only when choosing the destination.
		const from = animal.walkFrom;
		if (from && this.farm && !openStep(from.x, from.y,
			Math.floor(target.x / TILE_SIZE), Math.floor(target.y / TILE_SIZE),
			this.farm.fences ?? [], this.farm.gates ?? [])) {
			const currentX = Math.floor(animal.actor.pos.x / TILE_SIZE);
			const currentY = Math.floor(animal.actor.pos.y / TILE_SIZE);
			animal.actor.pos = center(currentX, currentY);
			animal.target = null;
			animal.walkFrom = null;
			this.begin(animal, "idle", 1200);
			return;
		}
		const difference = target.sub(animal.actor.pos);
		const distance = difference.size;
		const step = Math.min(distance, delta * 0.025);
		animal.actor.pos = distance <= step ? target : animal.actor.pos.add(difference.normalize().scale(step));
		animal.elapsed += delta;
		if (distance <= step) {
			animal.target = null;
			animal.walkFrom = null;
			this.begin(animal, "idle", 1200 + Math.random() * 1200);
		}
	}

	private begin(animal: AnimalState, phase: AnimalPhase, duration: number): void {
		animal.phase = phase;
		animal.elapsed = 0;
		animal.duration = duration;
	}

	private paint(animal: AnimalState): void {
		const frames = animalAnimationFrames[animal.home.species as AnimalId][animal.phase];
		const frame = Math.floor(animal.elapsed / (animal.phase === "walk" ? 130 : 260)) % frames.length;
		const key = `${animal.phase}:${frame}:${animal.facingRight}`;
		if (animal.painted === key) return;
		animal.painted = key;
		const source = frames[frame];
		const sprite = source.toSprite();
		const width = animal.home.species === "hen" ? 48 : 58;
		sprite.scale = ex.vec(width / source.width, width / source.width);
		sprite.flipHorizontal = animal.facingRight;
		animal.actor.graphics.use(sprite);
	}
}
