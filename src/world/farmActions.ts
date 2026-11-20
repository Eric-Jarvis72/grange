import { CROPS } from "../../shared/crops";
import {
	decodeCrop,
	type FarmToolId,
	orthogonalNeighbors,
} from "../../shared/farm";
import { comboSpreadChance } from "../../shared/mechanics";

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
		.filter(
			(t): t is FarmTileListTile => t !== undefined && t.state === wanted,
		);
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
