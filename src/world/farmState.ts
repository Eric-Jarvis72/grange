import {
	type CropId,
	CROPS,
	cropFamily,
	matureStage,
} from "../../shared/crops";
import {
	type FarmTile,
	FARM_GROW_MS,
	farmTileKey,
	orthogonalNeighbors,
} from "../../shared/farm";
import {
	LETTUCE_MOISTURE_DECAY_MULTIPLIER,
	mutationChance,
	TOMATO_COMPANION_BONUS,
	TOMATO_CROWD_PENALTY,
	WHEAT_PACK_CAP,
	WHEAT_PACK_PER_NEIGHBOR,
} from "../../shared/mechanics";
import { MAP_COLUMNS, MAP_ROWS } from "./mapData";

export type TileLookup = (x: number, y: number) => FarmTile | undefined;

export interface HarvestOptions {
	tool?: "hand" | "scythe";
	comboCount?: number;
	now?: number;
	rng?: () => number;
}

export interface HarvestResult {
	ok: boolean;
	reason?: string;
	cropId?: CropId;
	/** Rare mutation seed earned from this harvest, if any. */
	mutationSeed?: string;
	/** Standard seed dropped by a rare crop, if any. */
	bonusSeed?: string;
	/** Combo count granted by the harvest (Midas Wheat). */
	comboBonus?: number;
}

export function isMapInBounds(x: number, y: number): boolean {
	return (
		Number.isInteger(x) &&
		Number.isInteger(y) &&
		x >= 0 &&
		y >= 0 &&
		x < MAP_COLUMNS &&
		y < MAP_ROWS
	);
}

function neighborTiles(tile: FarmTile, lookup: TileLookup): FarmTile[] {
	return orthogonalNeighbors(tile.x, tile.y)
		.map(({ x, y }) => lookup(x, y))
		.filter((t): t is FarmTile => t !== undefined);
}

function isGrowing(tile: FarmTile): boolean {
	return tile.state === "planted" || tile.state === "watered" || tile.state === "ready";
}

/** +5% growth speed per adjacent wheat (capped +20%); tomato crowding/companion. */
export function growthSpeedMultiplier(tile: FarmTile, lookup: TileLookup): number {
	const neighbors = neighborTiles(tile, lookup);
	const family = cropFamily(tile.cropId);
	let speed = 1;

	if (family === "wheat") {
		const packed = neighbors.filter(
			(n) => isGrowing(n) && cropFamily(n.cropId) === "wheat",
		).length;
		speed += Math.min(WHEAT_PACK_CAP, packed * WHEAT_PACK_PER_NEIGHBOR);
	} else if (family === "tomato") {
		if (neighbors.some((n) => cropFamily(n.cropId) === "tomato")) {
			speed -= TOMATO_CROWD_PENALTY;
		}
		if (neighbors.some((n) => cropFamily(n.cropId) === "lettuce")) {
			speed += TOMATO_COMPANION_BONUS;
		}
	}

	if (hasMoistureRetention(tile, lookup)) {
		speed *= 1 / LETTUCE_MOISTURE_DECAY_MULTIPLIER;
	}
	return Math.max(0.1, speed);
}

/** A watered lettuce sponge slows its neighbours' moisture decay by 25%. */
export function hasMoistureRetention(tile: FarmTile, lookup: TileLookup): boolean {
	if (tile.state !== "watered" && tile.state !== "ready") return false;
	return neighborTiles(tile, lookup).some(
		(n) =>
			isGrowing(n) &&
			cropFamily(n.cropId) === "lettuce" &&
			(n.state === "watered" || n.state === "ready"),
	);
}

/** Positive neighbour synergy that boosts the rare-seed drop chance. */
export function synergyActive(tile: FarmTile, lookup: TileLookup): boolean {
	const neighbors = neighborTiles(tile, lookup);
	const family = cropFamily(tile.cropId);

	if (family === "wheat") {
		return (
			neighbors.filter((n) => isGrowing(n) && cropFamily(n.cropId) === "wheat")
				.length >= 2
		);
	}
	if (family === "lettuce") {
		return (
			(tile.state === "watered" || tile.state === "ready") &&
			neighbors.some(isGrowing)
		);
	}
	const tomatoes = neighbors.filter((n) => cropFamily(n.cropId) === "tomato").length;
	const lettuce = neighbors.filter((n) => cropFamily(n.cropId) === "lettuce").length;
	return tomatoes === 0 && lettuce >= 1;
}

/** Growth-stage index for a tile, or -1 when nothing is planted. */
export function cropStageIndex(tile: FarmTile, now: number = Date.now()): number {
	const mature = matureStage(tile.cropId);
	if (tile.state === "planted") return tile.regrowFrom ?? 0;
	if (tile.state === "ready") return mature;
	if (tile.state === "watered") {
		const from = tile.regrowFrom ?? 0;
		const start = tile.wateredAt ?? now;
		const end = tile.readyAt ?? start;
		const total = Math.max(1, end - start);
		const progress = Math.min(1, Math.max(0, (now - start) / total));
		return Math.min(mature, Math.round(from + progress * (mature - from)));
	}
	return -1;
}

export interface IFarmStore {
	getTile(x: number, y: number): FarmTile | undefined;
	tillGround(x: number, y: number): boolean;
	plantSeed(x: number, y: number, cropId?: CropId, now?: number): boolean;
	waterTile(x: number, y: number, now?: number, growMs?: number): boolean;
	harvestCrop(x: number, y: number, options?: HarvestOptions): HarvestResult;
	tick(now?: number): Array<{ x: number; y: number }>;
	readonly tomatoes: number;
	clear(): void;
}

/** Client-local farm simulation. A missing tile means untilled grass. */
export class LocalFarmStore implements IFarmStore {
	private tiles = new Map<string, FarmTile>();
	private readonly produce = new Map<CropId, number>();
	private readonly seeds = new Map<string, number>();

	private lookup: TileLookup = (x, y) => this.getTile(x, y);
	private rng: () => number = Math.random;

	get tomatoes(): number {
		return this.produceCount("tomato");
	}

	produceCount(cropId: CropId): number {
		return this.produce.get(cropId) ?? 0;
	}

	seedCount(seedId: string): number {
		return this.seeds.get(seedId) ?? 0;
	}

	addSeed(seedId: string, count = 1): void {
		if (count <= 0) return;
		this.seeds.set(seedId, this.seedCount(seedId) + count);
	}

	getTile(x: number, y: number): FarmTile | undefined {
		if (!isMapInBounds(x, y)) return undefined;
		return this.tiles.get(farmTileKey(x, y));
	}

	tillGround(x: number, y: number): boolean {
		if (!isMapInBounds(x, y)) return false;
		const key = farmTileKey(x, y);
		if (this.tiles.has(key)) return false;
		this.tiles.set(key, { x, y, state: "tilled", cropId: "tomato" });
		return true;
	}

	plantSeed(x: number, y: number, cropId: CropId = "tomato", now = Date.now()): boolean {
		if (!isMapInBounds(x, y)) return false;
		const tile = this.tiles.get(farmTileKey(x, y));
		if (tile?.state !== "tilled") return false;
		const def = CROPS[cropId];
		tile.cropId = cropId;
		tile.state = "planted";
		tile.plantedAt = now;
		tile.wateredAt = undefined;
		tile.readyAt = undefined;
		tile.regrowFrom = 0;
		tile.harvestsRemaining = def.harvests;
		return true;
	}

	waterTile(
		x: number,
		y: number,
		now = Date.now(),
		growMs = FARM_GROW_MS,
	): boolean {
		if (!isMapInBounds(x, y)) return false;
		const tile = this.tiles.get(farmTileKey(x, y));
		if (tile?.state !== "planted") return false;
		const speed = growthSpeedMultiplier(tile, this.lookup);
		tile.state = "watered";
		tile.wateredAt = now;
		tile.readyAt = now + growMs / speed;
		return true;
	}

	harvestCrop(x: number, y: number, options: HarvestOptions = {}): HarvestResult {
		if (!isMapInBounds(x, y)) return { ok: false, reason: "out of bounds" };
		const tile = this.tiles.get(farmTileKey(x, y));
		if (tile?.state !== "ready") return { ok: false, reason: "tile is not ready" };

		const def = CROPS[tile.cropId];
		const tool = options.tool ?? "hand";
		if (!canHarvest(def.harvestTool, tool)) {
			return {
				ok: false,
				reason:
					def.harvestTool === "scythe" ? "wheat needs a scythe" : "harvest by hand",
			};
		}

		const rng = options.rng ?? this.rng;
		const result: HarvestResult = { ok: true, cropId: tile.cropId };
		this.produce.set(tile.cropId, this.produceCount(tile.cropId) + 1);

		if (def.bonusSeed && rng() < (def.bonusSeedChance ?? 0)) {
			this.addSeed(def.bonusSeed);
			result.bonusSeed = def.bonusSeed;
		}
		if (def.comboBonus) result.comboBonus = def.comboBonus;

		if (def.mutationSeed) {
			const chance = mutationChance(
				options.comboCount ?? 0,
				synergyActive(tile, this.lookup),
			);
			if (rng() < chance) {
				this.addSeed(def.mutationSeed);
				result.mutationSeed = def.mutationSeed;
			}
		}

		this.applyHarvestResult(tile, def.harvests, def.regrowStage, options.now);
		return result;
	}

	private applyHarvestResult(
		tile: FarmTile,
		harvests: number,
		regrowStage: number,
		now?: number,
	): void {
		const remaining = (tile.harvestsRemaining ?? harvests) - 1;
		if (remaining > 0 && regrowStage >= 0) {
			tile.harvestsRemaining = remaining;
			tile.regrowFrom = regrowStage;
			tile.state = "watered";
			tile.wateredAt = now ?? Date.now();
			tile.readyAt = tile.wateredAt + FARM_GROW_MS / growthSpeedMultiplier(tile, this.lookup);
			return;
		}
		tile.state = "tilled";
		tile.harvestsRemaining = undefined;
		tile.regrowFrom = undefined;
		tile.wateredAt = undefined;
		tile.readyAt = undefined;
	}

	/** Advances watered crops to ready and applies passive watering. */
	tick(now: number = Date.now()): Array<{ x: number; y: number }> {
		this.passiveWater(now);
		const ready: Array<{ x: number; y: number }> = [];
		for (const tile of this.tiles.values()) {
			if (tile.state === "watered" && tile.readyAt !== undefined && now >= tile.readyAt) {
				tile.state = "ready";
				ready.push({ x: tile.x, y: tile.y });
			}
		}
		return ready;
	}

	/** Mature Frost-Crisp Lettuce keeps its neighbours watered each cycle. */
	private passiveWater(now: number): void {
		for (const tile of this.tiles.values()) {
			if (!CROPS[tile.cropId].passiveWater || tile.state !== "ready") continue;
			for (const { x, y } of orthogonalNeighbors(tile.x, tile.y)) {
				const neighbor = this.getTile(x, y);
				if (neighbor?.state === "planted") {
					const speed = growthSpeedMultiplier(neighbor, this.lookup);
					neighbor.state = "watered";
					neighbor.wateredAt = now;
					neighbor.readyAt = now + FARM_GROW_MS / speed;
				}
			}
		}
	}

	clear(): void {
		this.tiles.clear();
		this.produce.clear();
		this.seeds.clear();
	}
}

function canHarvest(rule: string, tool: "hand" | "scythe"): boolean {
	if (rule === "scythe") return tool === "scythe";
	return true;
}
