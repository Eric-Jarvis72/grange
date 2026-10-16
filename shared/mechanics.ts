/**
 * Tuning for the arcade farming layer: the combo tracker, grid synergy growth
 * modifiers, and rare-mutation seed drops. Kept apart from the crop registry so
 * balance changes read as one list.
 */

/** Combo expires this long after the last valid action. */
export const COMBO_WINDOW_MS = 1_500;
/** Extra grace once per hotbar swap, so Scythe -> Plant -> Water chains feel good. */
export const COMBO_SWAP_GRACE_MS = 400;
/** The floating counter only appears once the chain is worth showing. */
export const COMBO_DISPLAY_MIN = 3;

export const COMBO_SPEED_TIER = 5;
export const COMBO_SPEED_BONUS = 0.1;
export const COMBO_SPREAD_TIER = 10;
export const COMBO_SPREAD_CHANCE = 0.15;
export const COMBO_MUTATION_TIER = 15;
export const COMBO_MUTATION_MULTIPLIER = 1.5;

/** Base rare-mutation drop chance on a mature standard-crop harvest. */
export const MUTATION_BASE_CHANCE = 0.0015;
/** Added when the harvested crop has its positive neighbour synergy active. */
export const MUTATION_SYNERGY_BONUS = 0.0025;

/** Wheat "pack mentality": +5% growth speed per adjacent wheat, capped at +20%. */
export const WHEAT_PACK_PER_NEIGHBOR = 0.05;
export const WHEAT_PACK_CAP = 0.2;

/** Lettuce "moisture sponge": neighbours keep their watered state one stage. */
export const LETTUCE_MOISTURE_RETAIN_STAGES = 1;
export const LETTUCE_MOISTURE_DECAY_MULTIPLIER = 0.75;

/** Tomato "space hungry": crowding penalty and lettuce companion bonus. */
export const TOMATO_CROWD_PENALTY = 0.2;
export const TOMATO_COMPANION_BONUS = 0.15;

export type ComboTier = "none" | "speed" | "spread" | "mutation";

export function comboTier(comboCount: number): ComboTier {
	if (comboCount >= COMBO_MUTATION_TIER) return "mutation";
	if (comboCount >= COMBO_SPREAD_TIER) return "spread";
	if (comboCount >= COMBO_SPEED_TIER) return "speed";
	return "none";
}

/** Player movement multiplier while on farm tiles. */
export function comboMoveMultiplier(comboCount: number): number {
	return comboTier(comboCount) === "none" ? 1 : 1 + COMBO_SPEED_BONUS;
}

/** Chance to auto-apply a water/scythe action to one valid orthogonal neighbour. */
export function comboSpreadChance(comboCount: number): number {
	const tier = comboTier(comboCount);
	return tier === "spread" || tier === "mutation" ? COMBO_SPREAD_CHANCE : 0;
}

export function comboMutationMultiplier(comboCount: number): number {
	return comboTier(comboCount) === "mutation" ? COMBO_MUTATION_MULTIPLIER : 1;
}

/**
 * Rare seed drop chance for a mature standard harvest. Synergy and combo are
 * the only modifiers, capping at (base + synergy) * 1.5 = 0.6%.
 */
export function mutationChance(
	comboCount: number,
	synergyActive: boolean,
): number {
	const bonus = synergyActive ? MUTATION_SYNERGY_BONUS : 0;
	return (MUTATION_BASE_CHANCE + bonus) * comboMutationMultiplier(comboCount);
}

/** Effects of a combo bonus applied outward from a tile action. */
export interface ComboPerks {
	moveSpeed: number;
	spreadChance: number;
	mutationMultiplier: number;
	tier: ComboTier;
}

export function comboPerks(comboCount: number): ComboPerks {
	return {
		tier: comboTier(comboCount),
		moveSpeed: comboMoveMultiplier(comboCount),
		spreadChance: comboSpreadChance(comboCount),
		mutationMultiplier: comboMutationMultiplier(comboCount),
	};
}
