import { describe, expect, it } from "vitest";
import type { FenceGate } from "../../shared/types";
import { enclosedPen, openStep } from "./animalPen";

const square = [
	...[2, 3, 4, 5, 6].flatMap((x) => [{ x, y: 2 }, { x, y: 6 }]),
	...[3, 4, 5].flatMap((y) => [{ x: 2, y }, { x: 6, y }]),
];

describe("animal pens", () => {
	it("accepts cells inside a closed fence and rejects the exterior", () => {
		expect(enclosedPen(4, 4, square, [])).toBe(true);
		expect(enclosedPen(1, 4, square, [])).toBe(false);
	});
	it("rejects a gap or an open gate", () => {
		expect(enclosedPen(4, 4, square.filter(({ x, y }) => x !== 4 || y !== 2), [])).toBe(false);
		const gate: FenceGate = { x: 4, y: 2, direction: "horizontal", open: true };
		expect(enclosedPen(4, 4, square.filter(({ x, y }) => x !== 4 || y !== 2), [gate])).toBe(false);
		expect(enclosedPen(4, 4, square.filter(({ x, y }) => x !== 4 || y !== 2), [{ ...gate, open: false }])).toBe(true);
	});
	it("does not let a roaming hen cross a dividing rail", () => {
		const divider = [{ x: 4, y: 3 }, { x: 4, y: 4 }];
		expect(openStep(3, 3, 4, 3, [...square, ...divider], [])).toBe(false);
		expect(openStep(3, 4, 3, 3, [...square, ...divider], [])).toBe(true);
	});
	it("blocks a planned crossing when a fence is built mid-walk", () => {
		const from = { x: 3, y: 3 };
		const to = { x: 4, y: 3 };
		expect(openStep(from.x, from.y, to.x, to.y, [], [])).toBe(true);
		const posts = [{ x: 4, y: 3 }, { x: 4, y: 4 }];
		expect(openStep(from.x, from.y, to.x, to.y, posts, [])).toBe(false);
	});
	it("keeps a roaming animal inside a fully fenced single tile", () => {
		const posts = [
			{ x: 3, y: 3 }, { x: 4, y: 3 },
			{ x: 3, y: 4 }, { x: 4, y: 4 },
		];
		for (const [x, y] of [[2, 3], [4, 3], [3, 2], [3, 4]]) {
			expect(openStep(3, 3, x, y, posts, [])).toBe(false);
		}
	});
});
