import { describe, expect, it } from "vitest";
import {
	catalystAppliedNotice,
	catalystQueuedNotice,
} from "./catalystMessages";

describe("catalyst messages", () => {
	it("names the target crop when a catalyst is queued", () => {
		expect(catalystQueuedNotice("gilded-dust")).toBe(
			"The Gilded Dust will transform your Wheat at dawn.",
		);
	});

	it("summarises the dawn transformation", () => {
		expect(
			catalystAppliedNotice({
				item: "sun-shard",
				standard: "tomato",
				crop: "sunburst_tomato",
				count: 3,
			}),
		).toBe("The Sun Shard transformed 3 crops into Sun-Burst Tomato.");
	});
});
