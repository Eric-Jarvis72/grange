import type { ActiveFarm } from "../../shared/types";
import type { BlockRegistry } from "./blocking";
import { emitFarmAction } from "../socket";
import type { AnimalId } from "./livestockData";
import { ownsFarmTile, TILE_SIZE } from "./mapData";

const animalIds: readonly AnimalId[] = ["cow", "hen", "sheep", "pig"];
export const isAnimalId = (item: string | null): item is AnimalId =>
	item !== null && animalIds.some((animal) => animal === item);

export function animalPlacementReason(
	farm: ActiveFarm, animal: AnimalId, x: number, y: number, blocks: BlockRegistry,
	player: { x: number; y: number },
): string | null {
	if (!ownsFarmTile(x, y, farm.land_level ?? 0))
		return "Buy this land from the mayor first.";
	if ((farm.animals[animal] ?? 0) <= 0) return `No ${animal} in inventory.`;
	if (blocks.isBlocked(x, y) ||
		farm.tiles.some((tile) => tile.x === x && tile.y === y) ||
		(farm.placed_animals ?? []).some((animal) => animal.x === x && animal.y === y) ||
		(Math.floor(player.x / TILE_SIZE) === x && Math.floor(player.y / TILE_SIZE) === y))
		return "That spot is occupied.";
	return null;
}

export function placeAnimal(owner: string, animal: AnimalId, x: number, y: number,
	report: (text: string) => void): void {
	emitFarmAction(owner, { kind: "place_animal", animal, x, y }, (result) =>
		report(result.ok ? `${animal} placed on your farm.` : result.error ?? `Could not place ${animal}.`));
}

export function pickupAnimal(owner: string, animal: AnimalId, x: number, y: number,
	report: (text: string) => void): void {
	emitFarmAction(owner, { kind: "remove_animal", x, y }, (result) =>
		report(result.ok ? `${animal} returned to inventory.` : result.error ?? `Could not pick up ${animal}.`));
}
