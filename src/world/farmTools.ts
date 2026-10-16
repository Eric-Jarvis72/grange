import type { FarmToolId } from "../../shared/farm";
import type { FarmAction } from "../../shared/types";

export const TOOL_HINTS: Record<FarmToolId, string> = {
	hoe: "Hoe: click or drag on grass to till.",
	seed: "Seeds: click tilled soil to plant the selected seed.",
	bucket: "Bucket: click a sprout to water it.",
	scythe: "Scythe: swing at ripe wheat; pick softer crops by hand.",
};

export const TOOL_KEYS: Record<string, FarmToolId> = {
	Digit1: "hoe",
	Digit2: "seed",
	Digit3: "bucket",
	Digit4: "scythe",
};

export const TOOL_KIND: Record<FarmToolId, FarmAction["kind"]> = {
	hoe: "till",
	seed: "plant",
	bucket: "water",
	scythe: "harvest",
};
