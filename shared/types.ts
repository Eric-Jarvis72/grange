import type { CropId } from "./crops";
import type { FarmTileState } from "./farm";

/** A registered account as sent over the wire (no password hash). */
export interface Player {
	name: string;
}

/** The shared, multiplayer areas of the hub world. Farms are not hubs. */
export type HubArea = "marketplace" | "casino";

/** Another player standing in the same hub area. */
export interface HubPeer {
	name: string;
	x: number;
	y: number;
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

export type GateDirection = "horizontal" | "vertical";

/** A gate post with a swinging leaf and a shared, persisted open state. */
export interface FenceGate {
	x: number;
	y: number;
	direction: GateDirection;
	open: boolean;
}

/** A sprinkler anchored at the top-left tile of the 2x2 block it waters. */
export interface FarmSprinkler {
	x: number;
	y: number;
}

/** The full field and barn inventory for one farm. */
export interface ActiveFarm {
	owner: string;
	tiles: FarmTile[];
	/** Legacy tomato count, derived from `barn.tomato`. */
	tomatoes: number;
	/** Produce held per produce item id (crop id), e.g. `{ tomato: 3 }`. */
	barn: Record<string, number>;
	/** Livestock owned by this farm, keyed by animal species. */
	animals: Record<string, number>;
	land_level?: number;
	/** Whether strangers may join this farm. */
	is_public: boolean;
	/** Whether visitors may farm, build fences/gates, and move props. */
	visitor_edit: boolean;
	fences: Array<{ x: number; y: number }>;
	fence_count: number;
	gates: FenceGate[];
	gate_count: number;
	sprinklers: FarmSprinkler[];
	sprinkler_count: number;
	prop_overrides: Array<{
		index: number;
		asset: string;
		x: number;
		y: number;
		carried: boolean;
	}>;
	prop_inventory: Record<string, number>;
	storage: Record<string, number>;
}

export type FarmPropAction =
	| { kind: "dig"; index: number }
	| { kind: "place"; asset: string; x: number; y: number };

/** A deposit into or withdrawal from a farm's barn storage. */
export interface BarnAction {
	kind: "deposit" | "withdraw";
	item: string;
	count: number;
}

/** A visitor-safe request to open or close a gate. */
export interface FarmGateAction {
	kind: "toggle_gate";
	x: number;
	y: number;
}

/** A lightweight view of a farm for lobby listings. */
export interface FarmSummary {
	owner: string;
	tiles: number;
	planted: number;
	watered: number;
	ready: number;
	tomatoes: number;
	/** Whether the farm currently accepts visitors. */
	is_public: boolean;
}

/** A player's request to act on a tile of their own farm. */
export type FarmAction = {
	kind:
		| "till"
		| "plant"
		| "water"
		| "harvest"
		| "place_fence"
		| "remove_fence"
		| "place_gate"
		| "remove_gate"
		| "place_sprinkler"
		| "remove_sprinkler";
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
