import type { FenceGate } from "../../shared/types";
import { fenceKey, type FenceCoord, gatedEdgeFor, fenceGraph, edgeKey } from "./fenceData";

/** The fence posts form a grid of vertices; each rail borders two ground cells. */
export function enclosedPen(
	x: number, y: number, fences: FenceCoord[], gates: FenceGate[],
): boolean {
	const { nodes, edges } = fenceGraph(fences, gates);
	if (nodes.length < 4) return false;
	const open = new Set(gates.filter((gate) => gate.open)
		.map((gate) => gatedEdgeFor(gate, edges))
		.filter((edge) => edge !== null).map(({ edge }) => edgeKey(edge)));
	const walls = new Set(edges.filter((edge) => !open.has(edgeKey(edge)))
		.map((edge) => edgeKey(edge)));
	const minX = Math.min(x, ...nodes.map((node) => node.x)) - 1;
	const maxX = Math.max(x, ...nodes.map((node) => node.x));
	const minY = Math.min(y, ...nodes.map((node) => node.y)) - 1;
	const maxY = Math.max(y, ...nodes.map((node) => node.y));
	const seen = new Set<string>();
	const queue: Array<[number, number]> = [[x, y]];
	for (let head = 0; head < queue.length; head += 1) {
		const [cx, cy] = queue[head];
		if (cx <= minX || cx >= maxX || cy <= minY || cy >= maxY) return false;
		const key = fenceKey(cx, cy);
		if (seen.has(key)) continue;
		seen.add(key);
		const around: Array<[number, number, number, number, number, number]> = [
			[cx, cy - 1, cx, cy, cx + 1, cy],
			[cx, cy + 1, cx, cy + 1, cx + 1, cy + 1],
			[cx - 1, cy, cx, cy, cx, cy + 1],
			[cx + 1, cy, cx + 1, cy, cx + 1, cy + 1],
		];
		for (const [nx, ny, ax, ay, bx, by] of around) {
			const wall = edges.find((edge) =>
				(edge.from.x === ax && edge.from.y === ay && edge.to.x === bx && edge.to.y === by));
			if (!wall || !walls.has(edgeKey(wall))) queue.push([nx, ny]);
		}
	}
	return true;
}

/** Adjacent enclosed cells may still be divided by a rail within the pen. */
export function openStep(
	x: number, y: number, nextX: number, nextY: number,
	fences: FenceCoord[], gates: FenceGate[],
): boolean {
	if (Math.abs(nextX - x) + Math.abs(nextY - y) !== 1) return false;
	const { edges } = fenceGraph(fences, gates);
	const open = new Set(gates.filter((gate) => gate.open)
		.map((gate) => gatedEdgeFor(gate, edges))
		.filter((edge) => edge !== null).map(({ edge }) => edgeKey(edge)));
	const ax = Math.max(nextX, x);
	const ay = Math.max(nextY, y);
	const boundary = nextX !== x
		? [ax, y, ax, y + 1]
		: [x, ay, x + 1, ay];
	return !edges.some((edge) =>
		edge.from.x === boundary[0] && edge.from.y === boundary[1] &&
		edge.to.x === boundary[2] && edge.to.y === boundary[3] &&
		!open.has(edgeKey(edge)));
}
