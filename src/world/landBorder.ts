import {
	FARM_WORLD_MAX_COLUMN,
	FARM_WORLD_MIN_COLUMN,
	FARM_WORLD_MIN_ROW,
	farmBounds,
	TILE_SIZE,
} from "./mapData";

export interface BorderWalkDirection {
	x: number;
	y: number;
}

export interface BorderPosition {
	x: number;
	y: number;
}

/** How close the clamped player position must be to the edge to count as
 * pressing against it. Matches the player's 16px/32px movement insets. */
const EDGE_EPSILON = 0.75;

/**
 * True when the player is pressed against the edge of the land they own while
 * trying to walk into land that is still for sale. The river at the south edge
 * is not land, so it never produces the purchase hint.
 */
export function atUnownedLandBorder(
	direction: BorderWalkDirection,
	position: BorderPosition,
	level: number,
): boolean {
	const bounds = farmBounds(level);
	const left = bounds.minColumn * TILE_SIZE + 16;
	const right = (bounds.maxColumn + 1) * TILE_SIZE - 16;
	const top = bounds.minRow * TILE_SIZE + 32;
	return (
		(direction.x < 0 &&
			position.x <= left + EDGE_EPSILON &&
			bounds.minColumn > FARM_WORLD_MIN_COLUMN) ||
		(direction.x > 0 &&
			position.x >= right - EDGE_EPSILON &&
			bounds.maxColumn < FARM_WORLD_MAX_COLUMN) ||
		(direction.y < 0 &&
			position.y <= top + EDGE_EPSILON &&
			bounds.minRow > FARM_WORLD_MIN_ROW)
	);
}

/** Reports the land-purchase hint once per visit to an unowned border. */
export class LandBorderHint {
	private shown = false;

	constructor(private readonly report: (text: string) => void) {}

	update(
		direction: BorderWalkDirection,
		position: BorderPosition,
		level: number,
	): void {
		const atBorder = atUnownedLandBorder(direction, position, level);
		if (atBorder && !this.shown) {
			this.report("Talk with the Mayor to purchase more land.");
			this.shown = true;
		} else if (!atBorder) {
			this.shown = false;
		}
	}
}
