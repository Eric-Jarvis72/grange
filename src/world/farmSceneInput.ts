import { farmToolForItem } from "../inventory/items";
import { useGameStore } from "../store";
import type { AnimalPlacementPreview } from "./AnimalPlacementPreview";
import type { FarmPlacementPreview } from "./FarmPlacementPreview";
import type { FencePlacementPreview } from "./FencePlacementPreview";
import { selectedFarmItem } from "./fenceActions";
import type { InputManager } from "./InputManager";
import { ownsFarmTile, TILE_SIZE } from "./mapData";
import type { SprinklerPlacementPreview } from "./SprinklerPlacementPreview";

interface PlacementPreview {
	readonly active: boolean;
	clear(): void;
}

/** Drops placement previews whose item is no longer held or blocked by a modal. */
export function clearStalePlacements(
	selected: string | null,
	blocked: boolean,
	placement: FarmPlacementPreview,
	fencePlacement: FencePlacementPreview,
	sprinklerPlacement: SprinklerPlacementPreview,
	animalPlacement: AnimalPlacementPreview,
): void {
	const previews: Array<[PlacementPreview, string | null]> = [
		[placement, placement.selectedAsset],
		[fencePlacement, "fence"],
		[sprinklerPlacement, "sprinkler"],
		[animalPlacement, animalPlacement.selectedAnimal],
	];
	for (const [preview, item] of previews) {
		if (preview.active && (blocked || selected !== item)) preview.clear();
	}
}

/** Space acts on the player's tile only while an actual farming tool is held. */
export function farmActionOnSpace(
	input: InputManager,
	player: { x: number; y: number },
	act: (column: number, row: number) => void,
): void {
	if (!farmToolForItem(selectedFarmItem()) || !input.consumePressed("Space"))
		return;
	const column = Math.floor(player.x / TILE_SIZE);
	const row = Math.floor(player.y / TILE_SIZE);
	if (
		ownsFarmTile(
			column,
			row,
			useGameStore.getState().activeFarm?.land_level ?? 0,
		)
	)
		act(column, row);
}
