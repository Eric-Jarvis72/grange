import { describe, expect, it } from "vitest";
import { EMOTE_COLUMNS, EMOTE_IDS, EMOTES, getEmote } from "./emotes";

describe("emote registry", () => {
	it("gives every emote a unique row inside the atlas", () => {
		const rows = EMOTES.map((emote) => emote.row);
		expect(new Set(rows).size).toBe(EMOTES.length);
		for (const row of rows) expect(row).toBeLessThan(EMOTES.length);
	});

	it("keeps every emote's frame count within the atlas columns", () => {
		for (const emote of EMOTES) {
			expect(emote.frames).toBeGreaterThan(0);
			expect(emote.frames).toBeLessThanOrEqual(EMOTE_COLUMNS);
			expect(emote.frameMs).toBeGreaterThan(0);
		}
	});

	it("looks up known ids and rejects unknown ones", () => {
		expect(getEmote("wave")?.id).toBe("wave");
		expect(getEmote("mystery")).toBeUndefined();
		expect(EMOTE_IDS).toContain("dance");
		expect(EMOTE_IDS).toHaveLength(EMOTES.length);
	});
});
