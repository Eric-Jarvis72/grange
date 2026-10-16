import { type CropId, CROPS, cropFamily } from "../../shared/crops";
import { decodeCrop, type FarmToolId, orthogonalNeighbors } from "../../shared/farm";
import { mutationChance, comboSpreadChance } from "../../shared/mechanics";

/** A server tile as needed for action resolution. */
export interface ActionTileView {
	state: "tilled" | "planted" | "watered" | "ready";
	crop?: string;
}

export interface FarmTileListTile extends ActionTileView {
	x: number;
	y: number;
}

export interface ActionPlan {
	kind: "till" | "plant" | "water" | "harvest";
	tool: "hand" | "scythe";
}

export type ActionResolution =
	| { ok: true; plan: ActionPlan }
	| { ok: false; reason: string; shake?: boolean };

const TOOL_KIND: Record<FarmToolId, ActionPlan["kind"]> = {
	hoe: "till",
	seed: "plant",
	bucket: "water",
	scythe: "harvest",
};

/**
 * Decides the action a tool click performs on a tile. The scythe always swings
 * at a planted tile and lets the server enforce readiness, so a client whose
 * tile state lags the ticker can't miss a harvest. With any other tool, a
 * mature crop is harvested by hand; a scythe-only crop shows a shake prompt.
 */
export function resolveAction(
	tool: FarmToolId,
	tile: ActionTileView | undefined,
	tillable: boolean,
): ActionResolution {
	const kind = TOOL_KIND[tool];

	if (kind === "harvest") {
		if (tile && tile.state !== "tilled") {
			return { ok: true, plan: { kind: "harvest", tool: "scythe" } };
		}
		return { ok: false, reason: "Nothing ripe to harvest." };
	}

	if (tile?.state === "ready") {
		const { cropId } = decodeCrop(tile.crop);
		if (CROPS[cropId].harvestTool === "scythe") {
			return {
				ok: false,
				shake: true,
				reason: `${CROPS[cropId].name} needs a scythe.`,
			};
		}
		return { ok: true, plan: { kind: "harvest", tool: "hand" } };
	}

	if (kind === "till") {
		if (!tillable) return { ok: false, reason: "Hoe only works on grass." };
		if (tile) return { ok: false, reason: "That soil is already tilled." };
		return { ok: true, plan: { kind: "till", tool: "hand" } };
	}

	if (kind === "plant") {
		return tile?.state === "tilled"
			? { ok: true, plan: { kind: "plant", tool: "hand" } }
			: { ok: false, reason: "Plant seeds in tilled soil." };
	}
	return tile?.state === "planted"
		? { ok: true, plan: { kind: "water", tool: "hand" } }
		: { ok: false, reason: "Only a sprout can be watered." };
}

function isGrowing(state: ActionTileView["state"]): boolean {
	return state === "planted" || state === "watered" || state === "ready";
}

/**
 * Positive neighbour synergy for a mature harvested tile, evaluated against
 * the live field. Mirrors the LocalFarmStore rules for the drop roll.
 */
export function activeFarmSynergy(
	tile: FarmTileListTile,
	tiles: FarmTileListTile[],
): boolean {
	const byKey = new Map(tiles.map((t) => [`${t.x},${t.y}`, t]));
	const neighbors = orthogonalNeighbors(tile.x, tile.y)
		.map(({ x, y }) => byKey.get(`${x},${y}`))
		.filter((t): t is FarmTileListTile => t !== undefined);
	const family = cropFamily(decodeCrop(tile.crop).cropId);

	if (family === "wheat") {
		return (
			neighbors.filter(
				(n) => isGrowing(n.state) && cropFamily(decodeCrop(n.crop).cropId) === "wheat",
			).length >= 2
		);
	}
	if (family === "lettuce") {
		return (
			(tile.state === "watered" || tile.state === "ready") &&
			neighbors.some((n) => isGrowing(n.state))
		);
	}
	const tomatoes = neighbors.filter(
		(n) => cropFamily(decodeCrop(n.crop).cropId) === "tomato",
	).length;
	const lettuce = neighbors.filter(
		(n) => cropFamily(decodeCrop(n.crop).cropId) === "lettuce",
	).length;
	return tomatoes === 0 && lettuce >= 1;
}

/** Rolls a mature standard harvest for its rare mutation seed. */
export function rollMutation(
	cropId: CropId,
	comboCount: number,
	synergyActive: boolean,
	rng: () => number = Math.random,
): string | null {
	const seed = CROPS[cropId].mutationSeed;
	if (!seed) return null;
	return rng() < mutationChance(comboCount, synergyActive) ? seed : null;
}

/**
 * Picks a random orthogonal neighbour eligible for a combo-spread water or
 * scythe action, or null when none qualify.
 */
export function spreadTarget(
	tiles: FarmTileListTile[],
	column: number,
	row: number,
	kind: "water" | "harvest",
	rng: () => number = Math.random,
): { x: number; y: number } | null {
	const byKey = new Map(tiles.map((t) => [`${t.x},${t.y}`, t]));
	const wanted = kind === "water" ? "planted" : "ready";
	const valid = orthogonalNeighbors(column, row)
		.map(({ x, y }) => byKey.get(`${x},${y}`))
		.filter((t): t is FarmTileListTile => t !== undefined && t.state === wanted);
	if (valid.length === 0) return null;
	const pick = valid[Math.floor(rng() * valid.length)];
	return { x: pick.x, y: pick.y };
}

/**
 * Rolls the combo-spread chance and invokes `emit` for one eligible neighbour.
 * Kept callback-driven so the scene owns socket emission and this stays pure.
 */
export function maybeSpread(
	comboCount: number,
	tiles: FarmTileListTile[],
	column: number,
	row: number,
	kind: "water" | "harvest",
	tool: "hand" | "scythe",
	emit: (x: number, y: number, tool: "hand" | "scythe") => void,
	rng: () => number = Math.random,
): void {
	if (rng() >= comboSpreadChance(comboCount)) return;
	const target = spreadTarget(tiles, column, row, kind, rng);
	if (target) emit(target.x, target.y, tool);
}
