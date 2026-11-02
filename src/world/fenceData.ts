import type { FenceGate, GateDirection } from "../../shared/types";
import { TILE_SIZE } from "./mapData";
import type { TileCoord } from "./blocking";
import type { WalkObstacle } from "./walkCollisions";

export interface FenceCoord { x: number; y: number }
export interface FenceNode extends FenceCoord { worldX: number; worldY: number }
export interface FenceEdge { from: FenceNode; to: FenceNode; direction: "horizontal" | "vertical" }
export interface GatedEdge { edge: FenceEdge; flipped: boolean }

export const fenceKey = (x: number, y: number) => `${x},${y}`;
export const edgeKey = (edge: FenceEdge) =>
	`${fenceKey(edge.from.x, edge.from.y)}|${fenceKey(edge.to.x, edge.to.y)}`;

export const fenceInBounds = (x: number, y: number) =>
	Number.isInteger(x) && Number.isInteger(y) && x >= -2 && x <= 19 && y >= -4 && y <= 9;

/** One post at the center of each 64px ground tile; connections are derived. */
export function buildFenceGraph(coords: FenceCoord[]): { nodes: FenceNode[]; edges: FenceEdge[] } {
	const unique = new Map(coords.filter(({ x, y }) => fenceInBounds(x, y))
		.map(({ x, y }) => [fenceKey(x, y), { x, y, worldX: x * TILE_SIZE + 32, worldY: y * TILE_SIZE + 32 }]));
	const nodes = [...unique.values()];
	const edges: FenceEdge[] = [];
	for (const node of nodes) {
		const east = unique.get(fenceKey(node.x + 1, node.y));
		const south = unique.get(fenceKey(node.x, node.y + 1));
		if (east) edges.push({ from: node, to: east, direction: "horizontal" });
		if (south) edges.push({ from: node, to: south, direction: "vertical" });
	}
	return { nodes, edges };
}

/** Fences and gates share one post graph so either connects to its neighbors. */
export function fenceGraph(fences: FenceCoord[], gates: FenceGate[] = []) {
	return buildFenceGraph([...fences, ...gates]);
}

/** Horizontal wins on a tie, matching the server's stored gate direction. */
export function gateDirectionFor(x: number, y: number, coords: FenceCoord[]): GateDirection {
	const has = (column: number, row: number) =>
		coords.some((coord) => coord.x === column && coord.y === row);
	if (has(x - 1, y) || has(x + 1, y)) return "horizontal";
	if (has(x, y - 1) || has(x, y + 1)) return "vertical";
	return "horizontal";
}

/** The single rail a gate replaces, or null when it has no matching neighbor. */
export function gatedEdgeFor(gate: FenceGate, edges: FenceEdge[]): GatedEdge | null {
	const candidates = edges.filter((edge) =>
		edge.direction === gate.direction &&
		((edge.from.x === gate.x && edge.from.y === gate.y) ||
			(edge.to.x === gate.x && edge.to.y === gate.y)));
	const startsHere = (edge: FenceEdge) =>
		edge.from.x === gate.x && edge.from.y === gate.y;
	const endsHere = (edge: FenceEdge) =>
		edge.to.x === gate.x && edge.to.y === gate.y;
	// Vertical gates hinge on the north rail when one exists so the closed leaf
	// points up; only a south-only gate flips it down. Horizontal gates keep
	// their original east-first pick.
	const edge = gate.direction === "vertical"
		? candidates.find(endsHere) ?? candidates.find(startsHere) ?? candidates[0]
		: candidates.find(startsHere) ?? candidates[0];
	if (!edge) return null;
	return {
		edge,
		flipped: !startsHere(edge),
	};
}

/**
 * Mirrors a gate sprite so its hinge stays on the gate post. The closed vertical
 * art is drawn with its leaf pointing north; a south-pointing leaf is flipped.
 */
export function gateSpriteOrientation(
	gate: FenceGate,
	flipped: boolean,
): { flipHorizontal: boolean; flipVertical: boolean } {
	if (gate.direction === "horizontal") {
		return { flipHorizontal: flipped, flipVertical: false };
	}
	return { flipHorizontal: false, flipVertical: !gate.open && !flipped };
}

function openGateEdges(gates: FenceGate[], edges: FenceEdge[]): Set<string> {
	const open = new Set<string>();
	for (const gate of gates) {
		if (!gate.open) continue;
		const gated = gatedEdgeFor(gate, edges);
		if (gated) open.add(edgeKey(gated.edge));
	}
	return open;
}

export function fenceObstacles(coords: FenceCoord[], gates: FenceGate[] = []): WalkObstacle[] {
	const { nodes, edges } = fenceGraph(coords, gates);
	const open = openGateEdges(gates, edges);
	return [
		...nodes.map((node) => ({ left: node.worldX - 11, right: node.worldX + 11, top: node.worldY - 19, bottom: node.worldY + 5 })),
		...edges.filter((edge) => !open.has(edgeKey(edge))).map((edge) => edge.direction === "horizontal"
			? { left: edge.from.worldX, right: edge.to.worldX, top: edge.from.worldY - 12, bottom: edge.from.worldY + 5 }
			: { left: edge.from.worldX - 10, right: edge.from.worldX + 10, top: edge.from.worldY, bottom: edge.to.worldY }),
	];
}

export function fenceBlockedTiles(coords: FenceCoord[], gates: FenceGate[] = []): TileCoord[] {
	return fenceGraph(coords, gates).nodes.map(({ x, y }) => ({ column: x, row: y }));
}
