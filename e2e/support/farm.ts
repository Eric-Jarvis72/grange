import { expect, type Page } from "@playwright/test";
import { MAX_INTERACTION_DISTANCE } from "../../src/world/interaction";
import { MAP_COLUMNS, MAP_ROWS, TILE_SIZE } from "../../src/world/mapData";

/**
 * The page-space center of a world point, given in map pixels.
 *
 * Excalibur's FitContainer keeps the canvas at the map's aspect ratio, so a
 * world coordinate is a simple fraction of the canvas box.
 */
export async function worldPoint(
	page: Page,
	worldX: number,
	worldY: number,
): Promise<{ x: number; y: number }> {
	const box = await page.locator(".farm-map-canvas").boundingBox();
	expect(box).not.toBeNull();
	if (!box) throw new Error("the world canvas is not laid out");
	return {
		x: box.x + (worldX / 1152) * box.width,
		y: box.y + (worldY / 768) * box.height,
	};
}

/** Clicks a point given in world pixels. */
export async function clickWorld(
	page: Page,
	worldX: number,
	worldY: number,
): Promise<void> {
	const point = await worldPoint(page, worldX, worldY);
	await page.mouse.click(point.x, point.y);
}

/**
 * The page-space center of a farm map tile (0-based map coordinates).
 * `MAP_COLUMNS`/`MAP_ROWS` come from the same data the game renders with, so
 * the click math can't drift away from the real grid when tiles are redrawn or
 * the layout is restyled.
 */
export async function farmTilePosition(
	page: Page,
	column: number,
	row: number,
): Promise<{ x: number; y: number }> {
	const box = await page.locator("canvas.farm-map-canvas").boundingBox();
	expect(box).not.toBeNull();
	if (!box) throw new Error("the world canvas is not laid out");
	return {
		x: box.x + ((column + 0.5) / MAP_COLUMNS) * box.width,
		y: box.y + ((row + 0.5) / MAP_ROWS) * box.height,
	};
}

/** Moves the pointer over the center of a farm map tile. */
export async function hoverFarmTile(
	page: Page,
	column: number,
	row: number,
): Promise<void> {
	const { x, y } = await farmTilePosition(page, column, row);
	await page.mouse.move(x, y);
}

/** Clicks the center of a farm map tile, walking the player into reach first. */
export async function clickFarmTile(
	page: Page,
	column: number,
	row: number,
): Promise<void> {
	const { x, y } = await farmTilePosition(page, column, row);
	const targetX = (column + 0.5) * TILE_SIZE;
	const targetY = (row + 0.5) * TILE_SIZE;
	const current = await playerPosition(page);
	const standingOnTarget =
		current !== null &&
		Math.floor(current.x / TILE_SIZE) === column &&
		Math.floor(current.y / TILE_SIZE) === row;
	// Already close enough? Click from where we stand. Placement rules refuse
	// the player's own tile, so only skip the walk when standing somewhere else.
	if (
		current !== null &&
		!standingOnTarget &&
		Math.hypot(targetX - current.x, targetY - current.y) <=
			MAX_INTERACTION_DISTANCE - 16
	) {
		await page.mouse.click(x, y);
		return;
	}
	// Stand on the neighbouring tile rather than on the target: placement rules
	// refuse the player's own tile, and standing beside it keeps the farmer
	// sprite from covering the tile's pixels. One tile away is still within
	// MAX_INTERACTION_DISTANCE.
	const beside = column > 0 ? column - 1 : column + 1;
	await movePlayerNear(
		page,
		(beside + 0.5) * TILE_SIZE,
		(row + 0.5) * TILE_SIZE,
		12,
		// The click lands on a tile one square past the walk point, so once the
		// walk is abandoned the player must be close enough that the *clicked*
		// tile is inside reach, not merely the walk point.
		{ reach: MAX_INTERACTION_DISTANCE - TILE_SIZE - 8 },
	);
	await page.mouse.click(x, y);
}

/** The player's published world position, or null before the scene reports it. */
export async function playerPosition(
	page: Page,
): Promise<{ x: number; y: number } | null> {
	const pos = await page.evaluate(() => {
		const el = document.querySelector(".farm-map-page");
		return {
			x: Number(el?.getAttribute("data-player-x")),
			y: Number(el?.getAttribute("data-player-y")),
		};
	});
	return Number.isFinite(pos.x) && Number.isFinite(pos.y) ? pos : null;
}

/** Clicks a farm tile without moving the player. Prop placement is not
 * reach-gated, and walking into the tile would trip the "move out of the
 * placement area" rule, so placement tests click from where they stand. */
export async function tapFarmTile(
	page: Page,
	column: number,
	row: number,
): Promise<void> {
	const { x, y } = await farmTilePosition(page, column, row);
	await page.mouse.click(x, y);
}

/**
 * Walks the player until it stands within `tolerance` px of a world point.
 * Tools only reach `MAX_INTERACTION_DISTANCE`, so click-driven farm tests must
 * stand beside their target first. The scene publishes the player's world
 * position as data attributes, and movement is driven in short Node-side bursts
 * whose duration is calibrated from the distance each burst actually covers.
 * Bursts (rather than a continuous hold) keep the walk bounded on a loaded
 * runner, where a page-side polling loop can be throttled or its frames starved.
 * It gives up on a stalled walk only once the player is within `reach` px of
 * the target, so a caller whose real target sits one square beyond the walk
 * point can demand a tighter margin before the walk is abandoned.
 */
export async function movePlayerNear(
	page: Page,
	worldX: number,
	worldY: number,
	tolerance = 12,
	{ reach = MAX_INTERACTION_DISTANCE, timeout = 20_000 } = {},
): Promise<void> {
	const readPos = () =>
		page.evaluate(() => {
			const el = document.querySelector(".farm-map-page");
			return {
				x: Number(el?.getAttribute("data-player-x")),
				y: Number(el?.getAttribute("data-player-y")),
			};
		});
	const setKeys = (keys: string[], down: boolean) =>
		page.evaluate(
			({ keys, down }) => {
				for (const key of keys)
					window.dispatchEvent(
						new KeyboardEvent(down ? "keydown" : "keyup", {
							code: `Key${key.toUpperCase()}`,
						}),
					);
			},
			{ keys, down },
		);

	const deadline = Date.now() + timeout;
	// Pixels moved per millisecond, recalibrated from every burst so the walk
	// adapts to the 3x e2e speed and to a starved frame loop.
	let speed = 0.6;
	let held: string[] = [];
	let stalled = 0;
	try {
		for (;;) {
			const { x, y } = await readPos();
			if (!Number.isFinite(x) || !Number.isFinite(y)) return;
			const dx = worldX - x;
			const dy = worldY - y;
			const distance = Math.hypot(dx, dy);
			if (distance <= tolerance) return;
			if (Date.now() > deadline) return;
			// A slow runner can lag the game loop behind the poll and look
			// stalled; only bail out after a long pause and only when the point
			// the caller will actually act on is already reachable.
			if (stalled > 12 && distance <= reach) return;
			const keys: string[] = [];
			if (Math.abs(dx) > tolerance * 0.5) keys.push(dx > 0 ? "d" : "a");
			if (Math.abs(dy) > tolerance * 0.5) keys.push(dy > 0 ? "s" : "w");
			if (keys.length === 0) return;
			const burst = Math.max(20, Math.min(200, distance / speed));
			held = keys;
			await setKeys(keys, true);
			await page.waitForTimeout(burst);
			await setKeys(keys, false);
			held = [];
			const after = await readPos();
			const moved = Math.hypot(after.x - x, after.y - y);
			if (moved < 1) {
				stalled += 1;
				// No progress: the frames were likely starved, so hold longer.
				speed = Math.max(0.15, speed * 0.6);
			} else {
				stalled = 0;
				speed = Math.max(0.15, moved / burst);
			}
		}
	} finally {
		if (held.length) await setKeys(held, false);
	}
}
