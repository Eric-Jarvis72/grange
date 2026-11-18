import { describe, expect, it } from "vitest";
import type { NpcQuestStatus } from "../../shared/types";
import {
	NPC_GOAL,
	npcDialogue,
	npcProgress,
	npcSaleMessage,
	npcSeedOffers,
	npcSellCards,
	npcSellLabel,
	npcThanksNeeded,
	npcWantedCrops,
} from "./npcQuest";

function status(overrides: Partial<NpcQuestStatus> = {}): NpcQuestStatus {
	return {
		stage: "tomatoes",
		tomatoes: 0,
		lettuce: 0,
		wheat: 0,
		...overrides,
	};
}

describe("npcDialogue", () => {
	it("welcomes the player and points at the starter seeds", () => {
		expect(npcDialogue("intro")).toContain("Welcome to the Grange");
		expect(npcDialogue("intro")).toContain("seeds");
	});

	it("asks for tomatoes and then the supplies", () => {
		expect(npcDialogue("tomatoes")).toContain("ten tomatoes");
		expect(npcDialogue("supplies")).toContain("lettuce");
		expect(npcDialogue("supplies")).toContain("wheat");
	});

	it("sends the player to the market once complete", () => {
		expect(npcDialogue("complete")).toContain("market");
	});
});

describe("npcWantedCrops", () => {
	it("only asks for the current stage's crops", () => {
		expect(npcWantedCrops("intro")).toEqual([]);
		expect(npcWantedCrops("tomatoes")).toEqual(["tomato"]);
		expect(npcWantedCrops("supplies")).toEqual(["lettuce", "wheat"]);
		expect(npcWantedCrops("complete")).toEqual([]);
	});
});

describe("npcSellCards", () => {
	it("pays the market price for a full batch", () => {
		const [tomato] = npcSellCards(status(), { tomato: NPC_GOAL });
		expect(tomato.payout).toBe(50);
		expect(tomato.ready).toBe(true);
	});

	it("stays disabled until the barn holds ten", () => {
		const [tomato] = npcSellCards(status(), { tomato: 9 });
		expect(tomato.held).toBe(9);
		expect(tomato.ready).toBe(false);
	});

	it("does not offer a crop that was already handed in", () => {
		const [tomato] = npcSellCards(status({ tomatoes: NPC_GOAL }), {
			tomato: NPC_GOAL,
		});
		expect(tomato.ready).toBe(false);
	});

	it("shows both second-stage crops with their payouts", () => {
		const cards = npcSellCards(status({ stage: "supplies" }), {
			lettuce: 10,
			wheat: 10,
		});
		expect(cards.map((card) => [card.crop, card.payout])).toEqual([
			["lettuce", 70],
			["wheat", 40],
		]);
	});

	it("shows nothing once the quest is complete", () => {
		expect(npcSellCards(status({ stage: "complete" }), {})).toEqual([]);
	});
});

describe("npcSeedOffers", () => {
	it("offers ten-packs at market seed prices", () => {
		const offers = npcSeedOffers("supplies");
		expect(
			offers.map((offer) => [offer.marketItemId, offer.quantity, offer.price]),
		).toEqual([
			["lettuce-seed", 10, 40],
			["wheat-seed", 10, 20],
		]);
	});

	it("does not sell seeds before the tomato hand-in", () => {
		expect(npcSeedOffers("tomatoes")).toEqual([]);
		expect(npcSeedOffers("complete")).toEqual([]);
	});
});

describe("npcProgress", () => {
	it("reads the stage-specific counter", () => {
		const current = status({ tomatoes: 10, lettuce: 4 });
		expect(npcProgress(current, "tomato")).toBe(10);
		expect(npcProgress(current, "lettuce")).toBe(4);
		expect(npcProgress(current, "wheat")).toBe(0);
	});
});

describe("npcSellLabel", () => {
	it("shows the batch payout when ready and the count otherwise", () => {
		const [short] = npcSellCards(status(), { tomato: 3 });
		const [ready] = npcSellCards(status(), { tomato: NPC_GOAL });
		expect(npcSellLabel(short)).toBe("3 / 10");
		expect(npcSellLabel(ready)).toContain("50 GC");
	});
});

describe("npcSaleMessage", () => {
	it("chains the requests and ends with the market goodbye", () => {
		expect(npcSaleMessage("tomato")).toContain("lettuce");
		expect(npcSaleMessage("lettuce")).toContain("wheat");
		expect(npcSaleMessage("wheat")).toContain("market");
	});
});

describe("npcThanksNeeded", () => {
	it("shows a thank-you card when a hand-in opens a new request", () => {
		expect(npcThanksNeeded("tomatoes", "supplies")).toBe(true);
	});

	it("stays on the same screen for a mid-stage hand-in", () => {
		expect(npcThanksNeeded("supplies", "supplies")).toBe(false);
	});

	it("lets the farewell screen carry the final batch", () => {
		expect(npcThanksNeeded("supplies", "complete")).toBe(false);
		expect(npcThanksNeeded("intro", "tomatoes")).toBe(false);
	});
});
