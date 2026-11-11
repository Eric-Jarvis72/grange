import type * as ex from "excalibur";
import { describe, expect, it } from "vitest";
import { activeEmote, clearEmote, startEmote } from "./farmerEmoteState";

const actor = {} as ex.Actor;

describe("farmer emote state", () => {
	it("keeps an emote active until it is cleared", () => {
		startEmote(actor, "wave");
		expect(activeEmote(actor)).toBe("wave");
	});

	it("lets a newer emote replace the current one", () => {
		startEmote(actor, "wave");
		startEmote(actor, "cheer");
		expect(activeEmote(actor)).toBe("cheer");
	});

	it("clears an emote immediately", () => {
		startEmote(actor, "dance");
		clearEmote(actor);
		expect(activeEmote(actor)).toBeNull();
	});
});
