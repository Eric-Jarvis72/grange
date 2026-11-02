import type { ActiveFarm } from "../../shared/types";
import { useInventoryStore } from "../inventory/inventoryStore";
import { emitFarmAction } from "../socket";
import { useGameStore } from "../store";
import type { BlockRegistry } from "./blocking";
import { fenceInBounds, fenceKey } from "./fenceData";
import { isTillableTile, ownsFarmTile, TILE_SIZE } from "./mapData";

export function selectedFarmItem() {
	const inventory = useInventoryStore.getState();
	return inventory.hotbar[inventory.selectedHotbar]?.itemId ?? null;
}

export function fencePlacementReason(farm: ActiveFarm,
	column: number, row: number, blocks: BlockRegistry,
	player: { x: number; y: number }): string | null {
	if (!fenceInBounds(column, row)) return "Keep fences on dry land.";
	if (!ownsFarmTile(column, row, farm.land_level ?? 0)) return "Buy this land from the mayor first.";
	if (farm.fence_count <= 0) return "No fences left in inventory.";
	if (blocks.isBlocked(column, row) ||
		(farm.fences ?? []).some(({ x, y }) => fenceKey(x, y) === fenceKey(column, row)) ||
		(farm.gates ?? []).some(({ x, y }) => fenceKey(x, y) === fenceKey(column, row)) ||
		farm.tiles.some((tile) => tile.x === column && tile.y === row) ||
		(column === Math.floor(player.x / TILE_SIZE) && row === Math.floor(player.y / TILE_SIZE)))
		return "That tile is occupied.";
	return null;
}

export function actOnFence(owner: string, column: number, row: number,
	item: "fence" | "gate" | "shovel", blocks: BlockRegistry,
	player: { x: number; y: number }, report: (message: string) => void): void {
	const farm = useGameStore.getState().activeFarm;
	if (!farm) return;
	const fences = farm.fences ?? [];
	const gates = farm.gates ?? [];
	const fenceHere = fences.some(({ x, y }) => fenceKey(x, y) === fenceKey(column, row));
	const gateHere = gates.some(({ x, y }) => fenceKey(x, y) === fenceKey(column, row));

	if (item === "fence") {
		const reason = fencePlacementReason(farm, column, row, blocks, player);
		if (reason) { report(reason); return; }
	}
	if (item === "gate") {
		if (!fenceInBounds(column, row) || !isTillableTile(column, row) ||
			!ownsFarmTile(column, row, farm.land_level ?? 0) ||
			blocks.isBlocked(column, row) || fenceHere || gateHere || farm.gate_count <= 0 ||
			(column === Math.floor(player.x / TILE_SIZE) && row === Math.floor(player.y / TILE_SIZE)) ||
			farm.tiles.some((tile) => tile.x === column && tile.y === row)) {
			report("Place gates on clear grass.");
			return;
		}
	}

	if (item === "shovel" && !fenceHere && !gateHere) {
		report("No fence to dig up here.");
		return;
	}

	const kind = item === "fence"
		? "place_fence"
		: item === "gate"
			? "place_gate"
			: gateHere
				? "remove_gate"
				: "remove_fence";

	emitFarmAction(owner, { kind, x: column, y: row }, (result) => {
		if (!result.ok) {
			report(result.error ?? "Could not change fence.");
			return;
		}
		if (item === "fence") report("Fence placed.");
		else if (item === "gate") report("Gate placed.");
		else report(gateHere ? "Gate returned to inventory." : "Fence returned to inventory.");
	});
}
