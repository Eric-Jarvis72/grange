import { describe, expect, it } from "vitest";
import type { ActiveFarm } from "../../shared/types";
import { animalPlacementReason, isAnimalId } from "./animalPlacement";
import { BlockRegistry } from "./blocking";
import { livestockPens } from "./livestockData";

const perimeter = [
	...[2, 3, 4, 5, 6].flatMap((x) => [{ x, y: 2 }, { x, y: 6 }]),
	...[3, 4, 5].flatMap((y) => [{ x: 2, y }, { x: 6, y }]),
];

const farm: ActiveFarm = {
	owner: "tester", tiles: [], tomatoes: 0, barn: {}, storage: {},
	animals: { cow: 1, hen: 1, sheep: 1, pig: 1 }, land_level: 4,
	is_public: false, visitor_edit: false, fences: perimeter, fence_count: 4,
	gates: [], gate_count: 0, sprinklers: [], sprinkler_count: 0,
	prop_overrides: [], prop_inventory: {}, placed_animals: [],
};

describe("livestock placement", () => {
	it("recognizes every market animal as a placeable item", () => {
		for (const pen of livestockPens) expect(isAnimalId(pen.id)).toBe(true);
		expect(isAnimalId("fence")).toBe(false);
	});

	it("allows every species on open ground and inside the same pen", () => {
		for (const pen of livestockPens) {
			expect(animalPlacementReason({ ...farm, fences: [] }, pen.id, 8, 6,
				new BlockRegistry(), { x: 700, y: 500 })).toBeNull();
			expect(animalPlacementReason(farm, pen.id, 4, 4, new BlockRegistry(),
				{ x: 700, y: 500 })).toBeNull();
		}
	});

	it("allows another animal in a pen on a different tile, but not the same tile", () => {
		const occupied: ActiveFarm = { ...farm, placed_animals: [
			{ id: 1, species: "cow", x: 4, y: 4 },
		] };
		expect(animalPlacementReason(occupied, "pig", 4, 5,
			new BlockRegistry(), { x: 700, y: 500 })).toBeNull();
		expect(animalPlacementReason(occupied, "pig", 4, 4,
			new BlockRegistry(), { x: 700, y: 500 })).toBe("That spot is occupied.");
	});

	it("rejects water and unowned land", () => {
		expect(animalPlacementReason(farm, "pig", 4, 10,
			new BlockRegistry(), { x: 700, y: 500 })).not.toBeNull();
	});

	it("rejects an empty animal slot and an occupied pen tile", () => {
		expect(animalPlacementReason({ ...farm, animals: { ...farm.animals, pig: 0 } },
			"pig", 4, 4, new BlockRegistry(), { x: 700, y: 500 }))
			.toBe("No pig in inventory.");
		expect(animalPlacementReason({ ...farm, placed_animals: [
			{ id: 1, species: "cow", x: 4, y: 4 },
		] }, "pig", 4, 4, new BlockRegistry(), { x: 700, y: 500 }))
			.toBe("That spot is occupied.");
	});
});
