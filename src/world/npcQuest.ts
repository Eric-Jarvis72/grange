import { CROPS, harvestedSprite, stageSprite } from "../../shared/crops";
import type { NpcQuestStatus, NpcStage } from "../../shared/types";

/** Crops the farmhand will take, and the ones he sells seeds for. */
export type NpcCrop = "tomato" | "lettuce" | "wheat";
export type NpcSeedCrop = "lettuce" | "wheat";

/** Every hand-in and every seed bundle is a fixed batch of this many. */
export const NPC_GOAL = 10;

/** The placeholder farmhand's display name, shared with his scene actor. */
export { FARM_NPC_NAME as NPC_NAME } from "./farmNpcPosition";

/** A crop card in the trade window. */
export interface NpcSellCard {
	crop: NpcCrop;
	label: string;
	sprite: string;
	/** Grangecoin paid for the whole batch (market sell price × 10). */
	payout: number;
	/** How many of the ten have been handed in so far. */
	progress: number;
	/** How many sit in the barn right now. */
	held: number;
	/** True once the barn holds ten and the batch is still outstanding. */
	ready: boolean;
}

/** A repeatable ten-seed bundle the farmhand sells at market price. */
export interface NpcSeedOffer {
	crop: NpcSeedCrop;
	/** Id `/api/inventory/buy` expects. */
	marketItemId: "lettuce-seed" | "wheat-seed";
	label: string;
	sprite: string;
	quantity: number;
	/** Grangecoin charged for the whole bundle. */
	price: number;
}

const CROP_LABELS: Record<NpcCrop, string> = {
	tomato: "Tomatoes",
	lettuce: "Lettuce",
	wheat: "Wheat",
};

/** `sprite` fields are page URLs, so the trade window can render them. */
function produceSprite(crop: NpcCrop): string {
	return `/assets/${harvestedSprite(crop)}`;
}

function seedSprite(crop: NpcSeedCrop): string {
	return `/assets/${stageSprite(crop, 0)}`;
}

/** Which crops the current stage is asking for. */
export function npcWantedCrops(stage: NpcStage): NpcCrop[] {
	if (stage === "tomatoes") return ["tomato"];
	if (stage === "supplies") return ["lettuce", "wheat"];
	return [];
}

/** The delivered-so-far counter for one crop. */
export function npcProgress(status: NpcQuestStatus, crop: NpcCrop): number {
	return status[crop === "tomato" ? "tomatoes" : crop] ?? 0;
}

/**
 * The sell cards to draw for a stage. A card is only ready once the barn holds
 * a full batch and that crop has not already been handed in.
 */
export function npcSellCards(
	status: NpcQuestStatus,
	barn: Record<string, number>,
): NpcSellCard[] {
	return npcWantedCrops(status.stage).map((crop) => {
		const progress = npcProgress(status, crop);
		const held = barn[crop] ?? 0;
		return {
			crop,
			label: CROP_LABELS[crop],
			sprite: produceSprite(crop),
			payout: CROPS[crop].sellValue * NPC_GOAL,
			progress,
			held,
			ready: held >= NPC_GOAL && progress < NPC_GOAL,
		};
	});
}

/** The ten-seed bundles offered alongside the lettuce/wheat hand-ins. */
export function npcSeedOffers(stage: NpcStage): NpcSeedOffer[] {
	if (stage !== "supplies") return [];
	return (["lettuce", "wheat"] as const).map((crop) => ({
		crop,
		marketItemId: `${crop}-seed` as "lettuce-seed" | "wheat-seed",
		label: `${CROPS[crop].name} Seeds`,
		sprite: seedSprite(crop),
		quantity: NPC_GOAL,
		price: CROPS[crop].seedCost * NPC_GOAL,
	}));
}

/** The farmhand's standing line for a stage. */
export function npcDialogue(stage: NpcStage): string {
	switch (stage) {
		case "intro":
			return "Welcome to the Grange! I started you off with some seeds. Feel free to plant them, and once they grow you can sell back to me.";
		case "tomatoes":
			return "Have you got those ten tomatoes for me yet?";
		case "supplies":
			return "I'm also after ten lettuce and ten wheat. Buy the seeds from me if you're short.";
		case "complete":
			return "Much obliged! Meet me at the market.";
	}
}

/** The line shown right after a successful hand-in. */
export function npcSaleMessage(crop: NpcCrop): string {
	if (crop === "tomato") {
		return "Thank you kindly! I'm also after ten lettuce and ten wheat — I can sell you the seeds.";
	}
	if (crop === "lettuce") {
		return "Good lettuce. I still need ten wheat.";
	}
	return "Much obliged! Meet me at the market.";
}

/**
 * Whether a hand-in deserves its own thank-you screen before the next stage's
 * trade menu. Only a hand-in that opens a new request qualifies: the final
 * batch lands on `complete`, whose standing line is already the goodbye, and a
 * mid-stage hand-in keeps the same screen.
 */
export function npcThanksNeeded(before: NpcStage, after: NpcStage): boolean {
	return before !== "intro" && after !== before && after !== "complete";
}

/** The label on the trade window's primary button for a sell card. */
export function npcSellLabel(card: NpcSellCard): string {
	if (card.progress >= NPC_GOAL) return "Handed in";
	if (card.held < NPC_GOAL) return `${card.held} / ${NPC_GOAL}`;
	return `Sell ${NPC_GOAL} · ${card.payout} GC`;
}
