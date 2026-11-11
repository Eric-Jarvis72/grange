import type { Channel } from "phoenix";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useGameStore } from "../store";
import {
	attachEmotes,
	detachEmotes,
	getActiveEmote,
	parseEmote,
	publishEmote,
	resetEmotes,
} from "./emoteClient";

let handlers: Array<(payload: unknown) => void> = [];

function fakeChannel(): Channel {
	return {
		on: vi.fn((_event: string, callback: (payload: unknown) => void) => {
			handlers.push(callback);
			return 7;
		}),
		off: vi.fn(),
		push: vi.fn(),
	} as unknown as Channel;
}

beforeEach(() => {
	handlers = [];
	useGameStore.setState({ username: "Me" });
	resetEmotes();
});

afterEach(() => {
	resetEmotes();
	detachEmotes();
});

describe("parseEmote", () => {
	it("accepts known emotes", () => {
		expect(parseEmote({ name: "Ada", emote: "wave", at: 12 })).toEqual({
			name: "Ada",
			id: "wave",
			at: 12,
		});
	});

	it("rejects malformed and unknown payloads", () => {
		expect(parseEmote(null)).toBeNull();
		expect(parseEmote({ name: "Ada", emote: "mystery" })).toBeNull();
		expect(parseEmote({ name: 1, emote: "wave" })).toBeNull();
	});

	it("defaults a missing timestamp", () => {
		expect(parseEmote({ name: "Ada", emote: "cheer" })?.at).toBeGreaterThan(0);
	});
});

describe("emote transport", () => {
	it("tracks remote emotes and ignores the local player", () => {
		const channel = fakeChannel();
		attachEmotes(channel);

		handlers[0]({ name: "Bob", emote: "wave", at: 10 });
		expect(getActiveEmote("Bob")?.id).toBe("wave");

		handlers[0]({ name: "Me", emote: "dance", at: 11 });
		expect(getActiveEmote("Me")).toBeNull();

		detachEmotes();
		expect(getActiveEmote("Bob")).toBeNull();
		expect(channel.off).toHaveBeenCalledWith("emote", 7);
	});

	it("publishes through the attached channel", () => {
		const channel = fakeChannel();
		attachEmotes(channel);

		publishEmote("cheer");

		expect(channel.push).toHaveBeenCalledWith("emote", { emote: "cheer" });
	});

	it("drops emotes when no channel is attached", () => {
		publishEmote("wave");
		expect(getActiveEmote("Bob")).toBeNull();
	});
});
