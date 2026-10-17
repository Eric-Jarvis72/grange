import type { CropId } from "./crops";
import type { FarmTileState } from "./farm";

/** A registered account as sent over the wire (no password hash). */
export interface Player {
	name: string;
}

/** One tile of a farm's field, as sent by the server. */
export interface FarmTile {
	x: number;
	y: number;
	state: FarmTileState;
	/** Encoded crop id, optionally suffixed with remaining harvests. */
	crop?: string;
	planted_at?: number | null;
	watered_at?: number | null;
	ready_at?: number | null;
}

/** The full field and barn inventory for one farm. */
export interface ActiveFarm {
	owner: string;
	tiles: FarmTile[];
	/** Legacy tomato count, derived from `barn.tomato`. */
	tomatoes: number;
	/** Produce held per produce item id (crop id), e.g. `{ tomato: 3 }`. */
	barn: Record<string, number>;
	fences: Array<{ x: number; y: number }>;
	fence_count: number;
	prop_overrides: Array<{ index: number; asset: string; x: number; y: number; carried: boolean }>;
	prop_inventory: Record<string, number>;
}

export type FarmPropAction =
	| { kind: "dig"; index: number }
	| { kind: "place"; asset: string; x: number; y: number };

/** A lightweight view of a farm for lobby listings. */
export interface FarmSummary {
	owner: string;
	tiles: number;
	planted: number;
	watered: number;
	ready: number;
	tomatoes: number;
}

/** A player's request to act on a tile of their own farm. */
export type FarmAction = {
	kind: "till" | "plant" | "water" | "harvest" | "place_fence" | "remove_fence";
	x: number;
	y: number;
	/** Seed crop to plant (kind === "plant"). */
	crop?: CropId;
	/** Harvest tool in hand, so the server can enforce scythe-only crops. */
	tool?: "hand" | "scythe";
	/** Combo mutation multiplier carried on a harvest for the rare-seed roll. */
	comboMutationMultiplier?: number;
};

export interface ServerState {
	players: Player[];
	farms: FarmSummary[];
}
