import { describe, expect, it } from "vitest";
import {
	FARM_NPC_OFFSET,
	FARM_NPC_REACH,
	npcAnchor,
	npcPrompt,
} from "./farmNpcPosition";

describe("npcAnchor", () => {
	it("offsets the farmhand from the farmhouse base", () => {
		expect(npcAnchor({ x: 210, y: 260 })).toEqual({
			x: 210 + FARM_NPC_OFFSET.x,
			y: 260 + FARM_NPC_OFFSET.y,
		});
	});

	it("hides him when the house is packed into the inventory", () => {
		expect(npcAnchor(null)).toBeNull();
	});
});

describe("npcPrompt", () => {
	const npc = { x: 355, y: 300 };

	it("prompts when the player is close enough", () => {
		expect(npcPrompt({ x: npc.x, y: npc.y + 20 }, npc)).toBe(
			"Press E or Enter to talk to Walt",
		);
	});

	it("stays quiet outside the reach", () => {
		expect(
			npcPrompt({ x: npc.x + FARM_NPC_REACH + 1, y: npc.y }, npc),
		).toBeNull();
	});

	it("has no prompt when he is not on the farm", () => {
		expect(npcPrompt({ x: 0, y: 0 }, null)).toBeNull();
	});
});
