import { describe, expect, it } from "vitest";
import { buildFenceGraph, fenceBlockedTiles, fenceInBounds, fenceObstacles } from "./fenceData";

describe("placeable fences", () => {
	it("starts empty and accepts only grass-side grid coordinates", () => {
		expect(buildFenceGraph([])).toEqual({ nodes: [], edges: [] });
		expect(fenceInBounds(0, 0)).toBe(true);
		expect(fenceInBounds(17, 9)).toBe(true);
		expect(fenceInBounds(18, 9)).toBe(false);
		expect(fenceInBounds(1, 10)).toBe(false);
	});

	it("joins horizontal, vertical, and corner neighbors exactly once", () => {
		const { nodes, edges } = buildFenceGraph([
			{ x: 7, y: 6 }, { x: 8, y: 6 }, { x: 8, y: 7 }, { x: 8, y: 6 },
		]);
		expect(nodes).toHaveLength(3);
		expect(edges.map(({ direction }) => direction)).toEqual(["horizontal", "vertical"]);
		expect(nodes[0]).toMatchObject({ worldX: 480, worldY: 416 });
		expect(edges[0].to.worldX - edges[0].from.worldX).toBe(64);
		expect(edges[1].to.worldY - edges[1].from.worldY).toBe(64);
	});

	it("removing a post also removes its connections and blocked tile", () => {
		const before = [{ x: 7, y: 6 }, { x: 8, y: 6 }, { x: 9, y: 6 }];
		expect(buildFenceGraph(before).edges).toHaveLength(2);
		const after = before.filter(({ x }) => x !== 8);
		expect(buildFenceGraph(after).edges).toHaveLength(0);
		expect(fenceBlockedTiles(after)).toEqual([{ column: 7, row: 6 }, { column: 9, row: 6 }]);
		expect(fenceObstacles(after)).toHaveLength(2);
	});
});
