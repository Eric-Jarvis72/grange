import { describe, expect, it } from "vitest";
import type { FenceGate } from "../../shared/types";
import {
	buildFenceGraph,
	fenceBlockedTiles,
	fenceInBounds,
	fenceObstacles,
	gateDirectionFor,
	gatedEdgeFor,
	gateSpriteOrientation,
} from "./fenceData";
import { moveAroundObstacles } from "./walkCollisions";

const gate = (x: number, y: number, direction: "horizontal" | "vertical", open: boolean): FenceGate => ({
	x,
	y,
	direction,
	open,
});

describe("placeable fences", () => {
	it("starts empty and accepts only grass-side grid coordinates", () => {
		expect(buildFenceGraph([])).toEqual({ nodes: [], edges: [] });
		expect(fenceInBounds(0, 0)).toBe(true);
		expect(fenceInBounds(17, 9)).toBe(true);
		expect(fenceInBounds(18, 9)).toBe(true);
		expect(fenceInBounds(20, 9)).toBe(false);
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

describe("gates", () => {
	it("prefers a horizontal neighbor, then vertical, then horizontal", () => {
		expect(gateDirectionFor(4, 4, [{ x: 5, y: 4 }])).toBe("horizontal");
		expect(gateDirectionFor(4, 4, [{ x: 4, y: 5 }])).toBe("vertical");
		expect(gateDirectionFor(4, 4, [{ x: 4, y: 5 }, { x: 5, y: 4 }])).toBe("horizontal");
		expect(gateDirectionFor(4, 4, [])).toBe("horizontal");
	});

	it("finds the rail a gate replaces and flags a west/north hinge", () => {
		const { edges } = buildFenceGraph([{ x: 4, y: 4 }, { x: 5, y: 4 }]);
		expect(gatedEdgeFor(gate(4, 4, "horizontal", false), edges)?.flipped).toBe(false);
		expect(gatedEdgeFor(gate(5, 4, "horizontal", false), edges)?.flipped).toBe(true);
	});

	it("finds the north/south rail a vertical gate replaces", () => {
		const { edges } = buildFenceGraph([{ x: 4, y: 4 }, { x: 4, y: 5 }]);
		expect(gatedEdgeFor(gate(4, 4, "vertical", false), edges)?.flipped).toBe(false);
		expect(gatedEdgeFor(gate(4, 5, "vertical", false), edges)?.flipped).toBe(true);
	});

	it("prefers the north rail when a vertical gate is fenced on both sides", () => {
		const { edges } = buildFenceGraph([
			{ x: 4, y: 3 },
			{ x: 4, y: 4 },
			{ x: 4, y: 5 },
		]);
		const gated = gatedEdgeFor(gate(4, 4, "vertical", false), edges);
		expect(gated?.flipped).toBe(true);
		expect(gated?.edge.from).toMatchObject({ x: 4, y: 3 });
		expect(gated?.edge.to).toMatchObject({ x: 4, y: 4 });
	});

	it("still prefers the east rail for a horizontal gate", () => {
		const { edges } = buildFenceGraph([
			{ x: 3, y: 4 },
			{ x: 4, y: 4 },
			{ x: 5, y: 4 },
		]);
		const gated = gatedEdgeFor(gate(4, 4, "horizontal", false), edges);
		expect(gated?.flipped).toBe(false);
		expect(gated?.edge.to).toMatchObject({ x: 5, y: 4 });
	});

	it("keeps a gate hinge on its post in every orientation", () => {
		expect(gateSpriteOrientation(gate(4, 4, "horizontal", false), true))
			.toEqual({ flipHorizontal: true, flipVertical: false });
		// The closed vertical art already points up on a north rail.
		expect(gateSpriteOrientation(gate(4, 4, "vertical", false), true))
			.toEqual({ flipHorizontal: false, flipVertical: false });
		// A south rail mirrors the leaf so it still reaches the far post.
		expect(gateSpriteOrientation(gate(4, 4, "vertical", false), false))
			.toEqual({ flipHorizontal: false, flipVertical: true });
		// An open vertical gate always keeps the art's westward swing.
		expect(gateSpriteOrientation(gate(4, 4, "vertical", true), true))
			.toEqual({ flipHorizontal: false, flipVertical: false });
	});

	it("an open gate removes only its own rail obstacle", () => {
		const fences = [{ x: 4, y: 4 }, { x: 5, y: 4 }];
		const closed = fenceObstacles(fences, [gate(4, 4, "horizontal", false)]);
		const open = fenceObstacles(fences, [gate(4, 4, "horizontal", true)]);
		expect(closed).toHaveLength(3);
		expect(open).toHaveLength(2);
	});

	it("blocks walking through a closed gate and allows it when open", () => {
		const fences = [{ x: 2, y: 1 }];
		const start = { x: 128, y: 130 };
		const closed = fenceObstacles(fences, [gate(1, 1, "horizontal", false)]);
		const open = fenceObstacles(fences, [gate(1, 1, "horizontal", true)]);

		let blocked = start;
		let passable = start;
		for (let i = 0; i < 60; i += 1) {
			blocked = moveAroundObstacles(blocked.x, blocked.y, 0, -2, closed);
			passable = moveAroundObstacles(passable.x, passable.y, 0, -2, open);
		}
		expect(blocked.y).toBeGreaterThan(110);
		expect(passable.y).toBeLessThan(90);
	});

	it("opens the correct vertical rail", () => {
		const fences = [{ x: 1, y: 2 }];
		const start = { x: 130, y: 128 };
		const closed = fenceObstacles(fences, [gate(1, 1, "vertical", false)]);
		const open = fenceObstacles(fences, [gate(1, 1, "vertical", true)]);

		let blocked = start;
		let passable = start;
		for (let i = 0; i < 60; i += 1) {
			blocked = moveAroundObstacles(blocked.x, blocked.y, -2, 0, closed);
			passable = moveAroundObstacles(passable.x, passable.y, -2, 0, open);
		}
		expect(blocked.x).toBeGreaterThan(114);
		expect(passable.x).toBeLessThan(80);
	});
});
