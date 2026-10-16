/**
 * The starter crop registry: every plantable crop, its growth-stage sprites,
 * economy, harvest rules, and grid-synergy behaviour. Shared by the browser
 * simulation, the renderer, and the Phoenix backend so the numbers stay in
 * one place.
 *
 * Growth stages are ordered oldest (index 0) to mature (last index). Standard
 * crops use 5 stages, Midas Wheat and Frost-Crisp Lettuce use 4, and Sun-Burst
 * Tomato uses 3, so nothing may assume a fixed stage count.
 */

export type CropId =
	| "wheat"
	| "lettuce"
	| "tomato"
	| "midas_wheat"
	| "frost_lettuce"
	| "sunburst_tomato";

export type CropVariant = "standard" | "rare";

/** Which tool can legally harvest a mature crop. */
export type HarvestTool = "hand" | "scythe" | "both";

export type SynergyKind = "pack" | "moisture" | "space";

export interface CropDef {
	id: CropId;
	name: string;
	variant: CropVariant;
	/** Ordered stage sprite filenames under public/assets/crops. */
	stages: string[];
	/** Harvested-produce icon filename under public/assets/crops. */
	harvested: string;
	/** Inventory seed that plants this crop. */
	seedId: string;
	/** Grangecoin spent to buy one seed (derived from existing starter scale). */
	seedCost: number;
	/** Grangecoin earned per harvested produce. */
	sellValue: number;
	harvestTool: HarvestTool;
	/** Total harvests before the tile clears (regrowing crops have >1). */
	harvests: number;
	/** Stage to reset to after a regrow harvest; -1 clears the tile. */
	regrowStage: number;
	/** Grid-adjacency rule. */
	synergy: SynergyKind;
	/** Standard crops roll their rare variant seed on mature harvest. */
	mutationSeed?: string;
	/** Rare crops may drop this standard seed on harvest. */
	bonusSeed?: string;
	bonusSeedChance?: number;
	/** Combo count added immediately when harvested (Midas Wheat). */
	comboBonus?: number;
	/** Keeps orthogonal neighbours watered while mature and unharvested. */
	passiveWater?: boolean;
}

const stages5 = (crop: string, names: string[]): string[] =>
	names.map((label, index) => `${crop}_${index}_${label}.webp`);

export const CROPS: Record<CropId, CropDef> = {
	wheat: {
		id: "wheat",
		name: "Wheat",
		variant: "standard",
		stages: stages5("wheat", [
			"seed",
			"sprout",
			"young",
			"golden",
			"mature",
		]),
		harvested: "wheat_harvested.webp",
		seedId: "wheat-seed",
		seedCost: 2,
		sellValue: 4,
		harvestTool: "scythe",
		harvests: 1,
		regrowStage: -1,
		synergy: "pack",
		mutationSeed: "midas-wheat-seed",
	},
	lettuce: {
		id: "lettuce",
		name: "Lettuce",
		variant: "standard",
		stages: stages5("lettuce", ["seed", "sprout", "leaf", "loose", "mature"]),
		harvested: "lettuce_harvested.webp",
		seedId: "lettuce-seed",
		seedCost: 4,
		sellValue: 7,
		harvestTool: "both",
		harvests: 1,
		regrowStage: -1,
		synergy: "moisture",
		mutationSeed: "frost-lettuce-seed",
	},
	tomato: {
		id: "tomato",
		name: "Tomato",
		variant: "standard",
		stages: stages5("tomato", [
			"seed",
			"sprout",
			"medium",
			"flowering",
			"mature",
		]),
		harvested: "tomato_harvested.webp",
		seedId: "tomato-seed",
		seedCost: 8,
		sellValue: 5,
		harvestTool: "hand",
		harvests: 2,
		regrowStage: 2,
		synergy: "space",
		mutationSeed: "sunburst-tomato-seed",
	},
	midas_wheat: {
		id: "midas_wheat",
		name: "Midas Wheat",
		variant: "rare",
		stages: [
			"midas_wheat_0_seed.webp",
			"midas_wheat_1_sprout.webp",
			"midas_wheat_2_radiant.webp",
			"midas_wheat_3_mature.webp",
		],
		harvested: "midas_wheat_harvested.webp",
		seedId: "midas-wheat-seed",
		seedCost: 0,
		sellValue: 10,
		harvestTool: "scythe",
		harvests: 1,
		regrowStage: -1,
		synergy: "pack",
		comboBonus: 3,
	},
	frost_lettuce: {
		id: "frost_lettuce",
		name: "Frost-Crisp Lettuce",
		variant: "rare",
		stages: [
			"frost_lettuce_0_seed.webp",
			"frost_lettuce_1_sprout.webp",
			"frost_lettuce_2_young.webp",
			"frost_lettuce_3_mature.webp",
		],
		harvested: "frost_lettuce_harvested.webp",
		seedId: "frost-lettuce-seed",
		seedCost: 0,
		sellValue: 15,
		harvestTool: "both",
		harvests: 1,
		regrowStage: -1,
		synergy: "moisture",
		passiveWater: true,
	},
	sunburst_tomato: {
		id: "sunburst_tomato",
		name: "Sun-Burst Tomato",
		variant: "rare",
		stages: [
			"sunburst_tomato_0_sprout.webp",
			"sunburst_tomato_1_flowering.webp",
			"sunburst_tomato_2_mature.webp",
		],
		harvested: "sunburst_tomato_harvested.webp",
		seedId: "sunburst-tomato-seed",
		seedCost: 0,
		sellValue: 8,
		harvestTool: "hand",
		harvests: 3,
		regrowStage: 1,
		synergy: "space",
		bonusSeed: "tomato-seed",
		bonusSeedChance: 0.1,
	},
};

export const STANDARD_CROPS: CropId[] = ["wheat", "lettuce", "tomato"];

export function cropDef(id: CropId): CropDef {
	return CROPS[id];
}

export function isCropId(value: unknown): value is CropId {
	return typeof value === "string" && value in CROPS;
}

export function stageCount(id: CropId): number {
	return CROPS[id].stages.length;
}

export function matureStage(id: CropId): number {
	return stageCount(id) - 1;
}

/** Crops whose tiles count as the same species for synergy (variants count). */
export function cropFamily(id: CropId): "wheat" | "lettuce" | "tomato" {
	if (id === "wheat" || id === "midas_wheat") return "wheat";
	if (id === "lettuce" || id === "frost_lettuce") return "lettuce";
	return "tomato";
}

/** Stage sprite path for a crop at a (possibly out-of-range) stage index. */
export function stageSprite(id: CropId, stage: number): string {
	const def = CROPS[id];
	const index = Math.min(Math.max(0, Math.floor(stage)), def.stages.length - 1);
	return `crops/${def.stages[index]}`;
}

export function harvestedSprite(id: CropId): string {
	return `crops/${CROPS[id].harvested}`;
}
