import { describe, expect, it } from "vitest";
import type { FarmSummary } from "../../shared/types";
import { trainDestinations } from "./travelDestinations";

function farm(owner: string, is_public = true): FarmSummary {
	return {
		owner,
		tiles: 1,
		planted: 1,
		watered: 0,
		ready: 0,
		tomatoes: 0,
		is_public,
	};
}

const farms = [
	farm("me"),
	farm("Zed"),
	farm("Ann"),
	farm("Private", false),
];

const labels = (destinations: ReturnType<typeof trainDestinations>) =>
	destinations.map((destination) => destination.label);

const ids = (destinations: ReturnType<typeof trainDestinations>) =>
	destinations.map((destination) => destination.id);

describe("trainDestinations", () => {
	it("offers the marketplace and open farms from your own farm", () => {
		const options = trainDestinations({ kind: "farm", owner: "me" }, farms, "me");

		expect(ids(options)).toEqual(["marketplace", "farm-Ann", "farm-Zed"]);
		expect(labels(options)).toEqual([
			"Marketplace",
			"Ann's Farm",
			"Zed's Farm",
		]);
	});

	it("excludes private farms and your own farm from the list", () => {
		const options = trainDestinations({ kind: "farm", owner: "me" }, farms, "me");

		expect(ids(options)).not.toContain("farm-me");
		expect(ids(options)).not.toContain("farm-Private");
	});

	it("offers your farm first when boarding at the marketplace", () => {
		const options = trainDestinations({ kind: "marketplace" }, farms, "me");

		expect(ids(options)).toEqual(["home", "farm-Ann", "farm-Zed"]);
	});

	it("offers home, the marketplace, and other farms from a guest farm", () => {
		const options = trainDestinations({ kind: "farm", owner: "Ann" }, farms, "me");

		expect(ids(options)).toEqual(["home", "marketplace", "farm-Zed"]);
	});

	it("still offers a way out of a farm that is no longer public", () => {
		const options = trainDestinations({ kind: "farm", owner: "Private" }, farms, "me");

		// The current farm is always skipped, even when it is no longer public.
		expect(ids(options)).toEqual(["home", "marketplace", "farm-Ann", "farm-Zed"]);
	});
});
