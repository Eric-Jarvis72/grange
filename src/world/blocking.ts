import {
	TILE_SIZE,
	propBlocking,
	type MapProp,
} from "./mapData";

export interface TileCoord {
	column: number;
	row: number;
}

export function tileKey(column: number, row: number): string {
	return `${column},${row}`;
}

/** All tiles a bottom-anchored rect (x, y, width, height) touches. Strict:
 * any overlap counts. The epsilon keeps rects ending exactly on a tile
 * boundary from bleeding into the next tile. Output is clamped to the map
 * so tall sprites extending past the top edge stay clean. */
export function rectFootprintTiles(
	x: number,
	y: number,
	width: number,
	height: number,
): TileCoord[] {
	const tiles: TileCoord[] = [];
	const left = Math.max(
		-2,
		Math.floor((x - width / 2) / TILE_SIZE),
	);
	const right = Math.min(
		19,
		Math.floor((x + width / 2 - 0.001) / TILE_SIZE),
	);
	const top = Math.max(-4, Math.floor((y - height) / TILE_SIZE));
	const bottom = Math.min(
		11,
		Math.floor((y - 0.001) / TILE_SIZE),
	);
	for (let row = top; row <= bottom; row += 1) {
		for (let column = left; column <= right; column += 1) {
			tiles.push({ column, row });
		}
	}
	return tiles;
}

/** Tiles an upright prop (building, tree, furniture) stands on: the ground
 * row containing its base point, across its displayed width. Canopies may
 * overhang other tiles, but only the base blocks tools. */
export function groundFootprintTiles(
	x: number,
	y: number,
	width: number,
): TileCoord[] {
	const tiles: TileCoord[] = [];
	const row = Math.floor((y - 0.001) / TILE_SIZE);
	const left = Math.floor((x - width / 2) / TILE_SIZE);
	const right = Math.floor((x + width / 2 - 0.001) / TILE_SIZE);
	for (let column = left; column <= right; column += 1) {
		tiles.push({ column, row });
	}
	return tiles;
}

/**
 * Maps each tile to the indices of removable decor props ("none" rule:
 * flowers) anchored on it. The scene uses this to clear decor when a tile
 * is tilled. Returns prop indices (not actors) so it stays unit-testable.
 */
export function decorByTile(props: MapProp[]): Map<string, number[]> {
	const decor = new Map<string, number[]>();
	props.forEach((prop, index) => {
		if (propBlocking[prop.asset] !== "none") return;
		const key = tileKey(
			Math.floor(prop.x / TILE_SIZE),
			Math.floor(prop.y / TILE_SIZE),
		);
		const existing = decor.get(key);
		if (existing) existing.push(index);
		else decor.set(key, [index]);
	});
	return decor;
}

/**
 * Growable set of tool-blocked tiles. Entries are named (e.g. one per prop
 * or placed fence) and tiles are refcounted, so removing one of two
 * overlapping entries only unblocks tiles nothing else still covers.
 * A future server/DB swap can persist `entries()` and re-add them on load.
 */
export class BlockRegistry {
	private readonly tiles = new Map<string, Set<string>>();

	add(id: string, tiles: TileCoord[]): void {
		this.remove(id);
		for (const tile of tiles) {
			const key = tileKey(tile.column, tile.row);
			let owners = this.tiles.get(key);
			if (!owners) {
				owners = new Set();
				this.tiles.set(key, owners);
			}
			owners.add(id);
		}
	}

	remove(id: string): void {
		for (const [key, owners] of this.tiles) {
			owners.delete(id);
			if (owners.size === 0) this.tiles.delete(key);
		}
	}

	isBlocked(column: number, row: number): boolean {
		return this.tiles.has(tileKey(column, row));
	}

	blockedTiles(): TileCoord[] {
		return [...this.tiles.keys()].map((key) => {
			const [column, row] = key.split(",").map(Number);
			return { column, row };
		});
	}

	clear(): void {
		this.tiles.clear();
	}
}
