import { isFarmInBounds } from "../../shared/farm";
import { countItem, useInventoryStore } from "../inventory/inventoryStore";
import { emitFarmAction } from "../socket";
import { useGameStore } from "../store";
import { selectedFarmItem } from "./fenceActions";
import { TOOL_KIND } from "./farmTools";
import { TILE_SIZE } from "./mapData";

/** Space uses the held farm tool at the player's feet, not a building item. */
export function actOnPlayerFarmTile(owner: string, x: number, y: number,
	report: (message: string) => void): void {
	if (!["hoe", "seed-bag", "watering-can", "scythe"].includes(selectedFarmItem() ?? "")) return;
	const column = Math.floor(x / TILE_SIZE);
	const row = Math.floor(y / TILE_SIZE);
	if (!isFarmInBounds(column, row)) return;
	const tool = useGameStore.getState().tool;
	if (tool === "seed" && !consumeSeedAt(column, row, report)) return;
	emitFarmAction(owner, { kind: TOOL_KIND[tool], x: column, y: row });
}

/** Keep click-to-plant and Space-to-plant on the same seed-consumption rule. */
export function consumeSeedAt(column: number, row: number,
	report: (message: string) => void): boolean {
	const tile = useGameStore.getState().activeFarm?.tiles.find((entry) =>
		entry.x === column && entry.y === row);
	if (tile?.state !== "tilled") {
		report("Plant seeds in tilled soil.");
		return false;
	}
	const inventory = useInventoryStore.getState();
	if (countItem(inventory, "seed-bag") < 1) {
		report("Out of seeds — buy more at the market.");
		return false;
	}
	inventory.removeItem("seed-bag", 1);
	return true;
}
