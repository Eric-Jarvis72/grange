import {
	CATALYST_IDS,
	CATALYSTS,
	type CatalystItemId,
} from "../../shared/crops";
import {
	FISH,
	FISH_ORDER,
	type FishId,
	RODS,
	ROD_ORDER,
	type RodId,
} from "../world/fishingData";
import type { ItemDef } from "./items";

function rodItem(id: RodId): ItemDef {
	return {
		id,
		name: RODS[id].name,
		kind: "tool",
		maxStack: 1,
		icon: RODS[id].icon,
		description: RODS[id].blurb,
	};
}

function fishItem(id: FishId): ItemDef {
	return {
		id,
		name: FISH[id].name,
		kind: "fish",
		maxStack: 99,
		icon: FISH[id].emoji,
		description: FISH[id].blurb,
	};
}

/** Every fishing rod as an inventory item. */
export const ROD_ITEMS = Object.fromEntries(
	ROD_ORDER.map((id) => [id, rodItem(id)]),
) as Record<RodId, ItemDef>;

/** Caught fish are stackable inventory items; emoji stands in for art. */
export const FISH_ITEMS = Object.fromEntries(
	FISH_ORDER.map((id) => [id, fishItem(id)]),
) as Record<FishId, ItemDef>;

/** Overnight rare-crop catalysts, backed by the shared registry. */
export const CATALYST_ITEMS = Object.fromEntries(
	CATALYST_IDS.map((id) => [
		id,
		{
			id,
			name: CATALYSTS[id].name,
			kind: "catalyst",
			maxStack: 99,
			icon: CATALYSTS[id].icon,
			description: CATALYSTS[id].description,
		},
	]),
) as Record<CatalystItemId, ItemDef>;
