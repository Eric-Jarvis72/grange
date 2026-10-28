import { describe, expect, it, vi } from "vitest";
import { FarmFishing } from "./farmFishing";
import type { InputManager } from "./InputManager";
import { isNearWater } from "./mapData";

/** Near enough to the water to fish; 0 is far up the field. */
const SHORE = 700;
const FIELD = 100;

function fakeInput(pressed = false): InputManager {
	let queued = pressed;
	return {
		consumePressed: () => {
			const value = queued;
			queued = false;
			return value;
		},
	} as unknown as InputManager;
}

function setup(isOwner = true, pressed = false) {
	const prompts: Array<string | null> = [];
	const onOpen = vi.fn();
	const fishing = new FarmFishing(isOwner, onOpen, (prompt) =>
		prompts.push(prompt),
	);
	const input = fakeInput(pressed);
	return { fishing, prompts, onOpen, input };
}

describe("FarmFishing", () => {
	it("confirms the shore threshold matches the water reach", () => {
		expect(isNearWater(SHORE)).toBe(true);
		expect(isNearWater(FIELD)).toBe(false);
	});

	it("publishes the fishing prompt only once at the water", () => {
		const { fishing, prompts, input } = setup();
		fishing.update(SHORE, input);
		fishing.update(SHORE, fakeInput());
		expect(prompts).toEqual(["Press E to fish"]);
	});

	it("lets the train prompt win over fishing", () => {
		const { fishing, prompts, input } = setup();
		fishing.update(SHORE, input);
		fishing.setTravelPrompt("Press E to travel");
		expect(prompts).toEqual(["Press E to fish", "Press E to travel"]);
		fishing.setTravelPrompt(null);
		expect(prompts[prompts.length - 1]).toBe("Press E to fish");
	});

	it("clears the prompt when walking away", () => {
		const { fishing, prompts, input } = setup();
		fishing.update(SHORE, input);
		fishing.update(FIELD, fakeInput());
		expect(prompts[prompts.length - 1]).toBe(null);
	});

	it("opens fishing on a fresh F press at the water", () => {
		const { fishing, onOpen, input } = setup(true, true);
		fishing.update(SHORE, input);
		expect(onOpen).toHaveBeenCalledTimes(1);
	});

	it("drains E pressed away from the water instead of opening later", () => {
		const { fishing, onOpen } = setup(true, true);
		fishing.update(FIELD, fakeInput());
		fishing.update(SHORE, fakeInput());
		expect(onOpen).not.toHaveBeenCalled();
	});

	it("never offers fishing to a visitor", () => {
		const { fishing, onOpen, prompts, input } = setup(false, true);
		fishing.update(SHORE, input);
		expect(onOpen).not.toHaveBeenCalled();
		expect(prompts).toEqual([]);
	});

	it("hides the prompt while paused and reports it", () => {
		const { fishing, prompts, input } = setup();
		fishing.update(SHORE, input);
		fishing.setPaused(true);
		expect(fishing.isPaused).toBe(true);
		expect(prompts[prompts.length - 1]).toBe(null);
	});
});
