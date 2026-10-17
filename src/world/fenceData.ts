import { MAP_COLUMNS, MAP_ROWS, TILE_SIZE } from "./mapData";
import type { TileCoord } from "./blocking";
import type { WalkObstacle } from "./walkCollisions";

export interface FenceCoord { x: number; y: number }
export interface FenceNode extends FenceCoord { worldX: number; worldY: number }
export interface FenceEdge { from: FenceNode; to: FenceNode; direction: "horizontal" | "vertical" }

export const fenceKey = (x: number, y: number) => `${x},${y}`;
export const fenceInBounds = (x: number, y: number) =>
	Number.isInteger(x) && Number.isInteger(y) && x >= 0 && x < MAP_COLUMNS && y >= 0 && y < MAP_ROWS - 2;

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

export function fenceObstacles(coords: FenceCoord[]): WalkObstacle[] {
	const { nodes, edges } = buildFenceGraph(coords);
	return [
		...nodes.map((node) => ({ left: node.worldX - 11, right: node.worldX + 11, top: node.worldY - 19, bottom: node.worldY + 5 })),
		...edges.map((edge) => edge.direction === "horizontal"
			? { left: edge.from.worldX, right: edge.to.worldX, top: edge.from.worldY - 12, bottom: edge.from.worldY + 5 }
			: { left: edge.from.worldX - 10, right: edge.from.worldX + 10, top: edge.from.worldY, bottom: edge.to.worldY }),
	];
}

export function fenceBlockedTiles(coords: FenceCoord[]): TileCoord[] {
	return buildFenceGraph(coords).nodes.map(({ x, y }) => ({ column: x, row: y }));
}
