import type * as ex from "excalibur";
import type { ActiveFarm } from "../../shared/types";
import type { CropLayer } from "./cropLayer";
import { refreshTile } from "./tileSync";

export interface TileSyncDeps {
	terrain: ex.TileMap;
	sheet: ex.SpriteSheet;
	crops: CropLayer;
}

/**
 * Reconciles server tiles into terrain + crop visuals, tracking a per-tile
 * signature so only genuine changes repaint. Extracted from the scene to keep
 * FarmMapScene within the repository's size budget.
 */
export class FarmTileSync {
	private readonly synced = new Map<string, string>();
	private readonly live = new Set<string>();
	private lastTomatoes = -1;

	constructor(private readonly deps: TileSyncDeps) {}

	/** Restores cultivated graphics after a land expansion repaints the base map. */
	repaint(farm: ActiveFarm | null): void {
		for (const tile of farm?.tiles ?? []) this.paint(tile.x, tile.y, tile);
	}

	/** Returns true when the field changed and the HUD should refresh. */
	sync(farm: ActiveFarm | null): boolean {
		let changed = false;
		this.live.clear();

		if (farm) {
			for (const tile of farm.tiles) {
				const key = `${tile.x},${tile.y}`;
				this.live.add(key);
				const signature = `${tile.state}|${tile.crop ?? ""}|${tile.watered_at ?? ""}|${tile.ready_at ?? ""}`;
				if (this.synced.get(key) === signature) continue;
				this.synced.set(key, signature);
				this.paint(tile.x, tile.y, tile);
				changed = true;
			}
			if (farm.tomatoes !== this.lastTomatoes) {
				this.lastTomatoes = farm.tomatoes;
				changed = true;
			}
		}

		for (const key of [...this.synced.keys()]) {
			if (this.live.has(key)) continue;
			const [x, y] = key.split(",").map(Number);
			this.paint(x, y, undefined);
			this.synced.delete(key);
			changed = true;
		}
		return changed;
	}

	/** Repaints growing crops every frame so intermediate stages animate. */
	syncGrowing(farm: ActiveFarm | null, now: number): void {
		if (!farm) return;
		for (const tile of farm.tiles) {
			if (tile.state === "watered") {
				this.deps.crops.sync(tile.x, tile.y, tile, now);
			}
		}
	}

	private paint(
		column: number,
		row: number,
		tile: ActiveFarm["tiles"][number] | undefined,
	): void {
		refreshTile(this.deps.terrain, this.deps.sheet, this.deps.crops, column, row, tile);
	}
}
