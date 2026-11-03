import { useGameStore } from "../store";
import { farmToolForItem } from "../inventory/items";
import { selectedFarmItem } from "./fenceActions";
import type { InputManager } from "./InputManager";
import { ownsFarmTile, TILE_SIZE } from "./mapData";

/** Space acts on the player's tile only while an actual farming tool is held. */
export function farmActionOnSpace(input: InputManager,
	player: { x: number; y: number }, act: (column: number, row: number) => void): void {
	if (!farmToolForItem(selectedFarmItem()) || !input.consumePressed("Space")) return;
	const column = Math.floor(player.x / TILE_SIZE);
	const row = Math.floor(player.y / TILE_SIZE);
	if (ownsFarmTile(column, row, useGameStore.getState().activeFarm?.land_level ?? 0)) act(column, row);
}
