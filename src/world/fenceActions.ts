import { useInventoryStore } from "../inventory/inventoryStore";
import { emitFarmAction } from "../socket";
import { useGameStore } from "../store";
import type { BlockRegistry } from "./blocking";
import { fenceInBounds, fenceKey } from "./fenceData";
import { isTillableTile, TILE_SIZE } from "./mapData";

export function selectedFarmItem() {
	const inventory = useInventoryStore.getState();
	return inventory.hotbar[inventory.selectedHotbar]?.itemId ?? null;
}

export function actOnFence(owner: string, column: number, row: number,
	item: "fence" | "shovel", blocks: BlockRegistry,
	player: { x: number; y: number }, report: (message: string) => void): void {
	const farm = useGameStore.getState().activeFarm;
	if (!farm) return;
	const exists = farm.fences.some(({ x, y }) => fenceKey(x, y) === fenceKey(column, row));
	if (item === "fence") {
		if (!fenceInBounds(column, row) || !isTillableTile(column, row) ||
			blocks.isBlocked(column, row) || exists || farm.fence_count <= 0 ||
			(column === Math.floor(player.x / TILE_SIZE) && row === Math.floor(player.y / TILE_SIZE)) ||
			farm.tiles.some((tile) => tile.x === column && tile.y === row)) {
			report("Place fences on clear grass.");
			return;
		}
	}
	if (item === "shovel" && !exists) {
		report("No fence to dig up here.");
		return;
	}
	emitFarmAction(owner, {
		kind: item === "fence" ? "place_fence" : "remove_fence", x: column, y: row,
	}, (result) => report(result.ok
		? (item === "fence" ? "Fence placed." : "Fence returned to inventory.")
		: result.error ?? "Could not change fence."));
}
