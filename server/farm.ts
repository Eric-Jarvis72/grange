import {
	FARM_GROW_MS,
	FARM_HARVEST_YIELD,
	farmTileKey,
	isFarmInBounds,
	type FarmInventory,
	type FarmReadyTile,
	type FarmTile,
} from "../shared/farm";

export class InMemoryFarmStore {
	private tiles = new Map<string, Map<string, FarmTile>>();
	private inventories = new Map<string, FarmInventory>();

	private playerTiles(player: string): Map<string, FarmTile> {
		let map = this.tiles.get(player);
		if (!map) {
			map = new Map();
			this.tiles.set(player, map);
		}
		return map;
	}

	/** Returns the live stored tile; undefined means untilled (never stored). */
	getTile(player: string, x: number, y: number): FarmTile | undefined {
		if (!isFarmInBounds(x, y)) return undefined;
		return this.tiles.get(player)?.get(farmTileKey(x, y));
	}

	getPlayerTiles(player: string): FarmTile[] {
		return [...(this.tiles.get(player)?.values() ?? [])];
	}

	/** Returns the live inventory, creating the default on first access. */
	getInventory(player: string): FarmInventory {
		let inv = this.inventories.get(player);
		if (!inv) {
			inv = { tomatoSeed: Number.POSITIVE_INFINITY, tomato: 0 };
			this.inventories.set(player, inv);
		}
		return inv;
	}

	tillGround(player: string, x: number, y: number): boolean {
		if (!isFarmInBounds(x, y)) return false;
		const tiles = this.playerTiles(player);
		const key = farmTileKey(x, y);
		if (tiles.has(key)) return false;
		tiles.set(key, { x, y, state: "tilled", cropId: "tomato" });
		return true;
	}

	plantSeed(
		player: string,
		x: number,
		y: number,
		now: number = Date.now(),
	): boolean {
		if (!isFarmInBounds(x, y)) return false;
		const tile = this.getTile(player, x, y);
		if (tile?.state !== "tilled") return false;
		tile.state = "planted";
		tile.plantedAt = now;
		return true;
	}

	waterTile(
		player: string,
		x: number,
		y: number,
		now: number = Date.now(),
		growMs: number = FARM_GROW_MS,
	): boolean {
		if (!isFarmInBounds(x, y)) return false;
		const tile = this.getTile(player, x, y);
		if (tile?.state !== "planted") return false;
		tile.state = "watered";
		tile.wateredAt = now;
		tile.readyAt = now + growMs;
		return true;
	}

	harvestCrop(player: string, x: number, y: number): boolean {
		if (!isFarmInBounds(x, y)) return false;
		const tile = this.getTile(player, x, y);
		if (tile?.state !== "ready") return false;
		tile.state = "tilled";
		tile.wateredAt = undefined;
		tile.readyAt = undefined;
		this.getInventory(player).tomato += FARM_HARVEST_YIELD;
		return true;
	}

	/** Flips every watered tile with readyAt <= now to ready. */
	tickFarm(now: number = Date.now()): FarmReadyTile[] {
		const ready: FarmReadyTile[] = [];
		for (const [player, tiles] of this.tiles) {
			for (const tile of tiles.values()) {
				if (
					tile.state === "watered" &&
					tile.readyAt !== undefined &&
					now >= tile.readyAt
				) {
					tile.state = "ready";
					ready.push({ player, x: tile.x, y: tile.y });
				}
			}
		}
		return ready;
	}

	clear(): void {
		this.tiles.clear();
		this.inventories.clear();
	}
}
