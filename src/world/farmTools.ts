import type { FarmToolId } from "../../shared/farm";

export const TOOL_HINTS: Record<FarmToolId, string> = {
	hoe: "Hoe: click or drag on grass to till.",
	seed: "Seeds: click tilled soil to plant the selected seed.",
	bucket: "Bucket: click a sprout to water it.",
	scythe: "Scythe: swing at ripe wheat; pick softer crops by hand.",
};
