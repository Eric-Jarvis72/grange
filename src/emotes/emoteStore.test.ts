import { beforeEach, describe, expect, it, vi } from "vitest";
import {
	clearLocalHandler,
	closeEmoteWheel,
	isEmoteWheelOpen,
	openEmoteWheel,
	setLocalHandler,
	useEmoteStore,
} from "./emoteStore";

beforeEach(() => {
	useEmoteStore.setState({ open: false, localHandler: null });
});

describe("emote store", () => {
	it("opens and closes the wheel", () => {
		openEmoteWheel();
		expect(isEmoteWheelOpen()).toBe(true);
		closeEmoteWheel();
		expect(isEmoteWheelOpen()).toBe(false);
	});

	it("plays the chosen emote and closes the wheel", () => {
		const handler = vi.fn();
		setLocalHandler(handler);
		openEmoteWheel();

		useEmoteStore.getState().choose("wave");

		expect(handler).toHaveBeenCalledWith("wave");
		expect(isEmoteWheelOpen()).toBe(false);
	});

	it("only clears the handler it registered", () => {
		const first = vi.fn();
		const second = vi.fn();
		setLocalHandler(first);

		clearLocalHandler(second);
		expect(useEmoteStore.getState().localHandler).toBe(first);

		clearLocalHandler(first);
		expect(useEmoteStore.getState().localHandler).toBeNull();
	});
});
