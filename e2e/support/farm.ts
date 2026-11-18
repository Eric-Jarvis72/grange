import { expect, type Page } from "@playwright/test";
import { MAX_INTERACTION_DISTANCE } from "../../src/world/interaction";
import {
	MAP_HEIGHT,
	MAP_WIDTH,
	TILE_SIZE,
} from "../../src/world/mapData";

/**
 * The page-space position of a world point.
 *
 * The canvas fills the browser, so the visible world is wider (or taller)
 * than the map: Excalibur keeps the map's height and widens the resolution to
 * the browser aspect. The farm camera is centred on the map, so convert world
 * pixels through the visible-area origin and scale.
 */
async function worldToPage(
	page: Page,
	worldX: number,
	worldY: number,
): Promise<{ x: number; y: number }> {
	const canvas = page.locator(".farm-map-canvas");
	const box = await canvas.boundingBox();
	expect(box).not.toBeNull();
	if (!box) throw new Error("the world canvas is not laid out");
	const view = await canvas.evaluate((el) => {
		const { viewLeft, viewTop, viewWidth, viewHeight } = (
			el as HTMLCanvasElement
		).dataset;
		return {
			left: Number(viewLeft),
			top: Number(viewTop),
			width: Number(viewWidth),
			height: Number(viewHeight),
		};
	});
	// Fall back to a centred map if the scene has not published its camera yet.
	const aspect = box.width / box.height;
	const mapAspect = MAP_WIDTH / MAP_HEIGHT;
	const fallbackWidth = aspect >= mapAspect ? MAP_HEIGHT * aspect : MAP_WIDTH;
	const fallbackHeight = aspect >= mapAspect ? MAP_HEIGHT : MAP_WIDTH / aspect;
	const viewWidth =
		Number.isFinite(view.width) && view.width > 0
			? view.width
			: fallbackWidth;
	const viewHeight =
		Number.isFinite(view.height) && view.height > 0
			? view.height
			: fallbackHeight;
	const left = Number.isFinite(view.left)
		? view.left
		: (MAP_WIDTH - viewWidth) / 2;
	const top = Number.isFinite(view.top)
		? view.top
		: (MAP_HEIGHT - viewHeight) / 2;
	const scale = box.width / viewWidth;
	return {
		x: box.x + (worldX - left) * scale,
		y: box.y + (worldY - top) * (box.height / viewHeight),
	};
}

/** The page-space center of a world point, given in map pixels. */
export async function worldPoint(
	page: Page,
	worldX: number,
	worldY: number,
): Promise<{ x: number; y: number }> {
	return worldToPage(page, worldX, worldY);
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
 * `TILE_SIZE` and the map dimensions come from the same data the game renders
 * with, so the click math can't drift away from the real grid when tiles are
 * redrawn or the layout is restyled.
 */
export async function farmTilePosition(
	page: Page,
	column: number,
	row: number,
): Promise<{ x: number; y: number }> {
	return worldToPage(
		page,
		(column + 0.5) * TILE_SIZE,
		(row + 0.5) * TILE_SIZE,
	);
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
	// The click lands one tile past the walk point, so the walk must stop close
	// enough that the *clicked* tile is inside reach, not merely the point:
	// a tile's width plus a small margin back from `MAX_INTERACTION_DISTANCE`.
	const margin = MAX_INTERACTION_DISTANCE - TILE_SIZE - 8;
	await movePlayerNear(
		page,
		(beside + 0.5) * TILE_SIZE,
		(row + 0.5) * TILE_SIZE,
		margin,
		{ reach: margin },
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

/** How often a held walk re-asserts its keydown, in case a paused scene dropped it. */
const WALK_RESEND_MS = 60;
/** An axis within this many pixels is close enough to stop steering it. */
const WALK_DEADBAND = 6;
/** Consecutive position updates without closing in before the walk gives up. */
const WALK_STALL_LIMIT = 8;

/**
 * Walks toward a world point until it is inside the player's reach, stopping
 * short of the point itself.
 *
 * Use this to approach a prop before clicking it: the click lands on the prop's
 * center, which sits inside its obstacle footprint, so walking onto it is
 * impossible. Halting a body-length away keeps the walk short and leaves a
 * margin under `MAX_INTERACTION_DISTANCE` for the click that follows.
 */
export async function movePlayerIntoReach(
	page: Page,
	worldX: number,
	worldY: number,
): Promise<void> {
	await movePlayerNear(page, worldX, worldY, MAX_INTERACTION_DISTANCE - 16);
}

/**
 * Walks the player until it stands within `tolerance` px of a world point.
 *
 * Tools only reach `MAX_INTERACTION_DISTANCE`, so click-driven farm tests must
 * stand beside their target first. The scene publishes the player's world
 * position as data attributes, and the whole walk runs *inside* the page: it
 * watches those attributes and releases the movement keys on the frame that
 * publishes the new position.
 *
 * That matters on a loaded runner. The farm canvas can drop to a couple of fps
 * while three workers share four cores, and one frame then covers up to 48 px.
 * A controller that polls from Node sees the position hundreds of milliseconds
 * late, so by the time it releases the keys the player is already past the
 * target (and the old burst timer had the same problem). Watching from inside
 * the page means the keys stop before the next frame moves the player.
 *
 * A walk point can sit inside a prop's obstacle footprint (clicking a prop's
 * center is the normal way to dig it), so once the player is within `reach` px
 * and has stopped getting closer the walk ends there instead of pressing into
 * the obstacle until the budget is spent.
 */
export async function movePlayerNear(
	page: Page,
	worldX: number,
	worldY: number,
	tolerance = 24,
	{ reach = MAX_INTERACTION_DISTANCE, timeout = 10_000 } = {},
): Promise<void> {
	try {
		await page.evaluate(
			({ worldX, worldY, tolerance, reach, timeout, resendMs, deadband, stallLimit }) => {
				const root = document.querySelector(".farm-map-page");
				if (!root) return;
				const read = () => {
					const x = Number(root.getAttribute("data-player-x"));
					const y = Number(root.getAttribute("data-player-y"));
					return Number.isFinite(x) && Number.isFinite(y) ? { x, y } : null;
				};
				const send = (keys: string[], down: boolean) => {
					for (const key of keys)
						window.dispatchEvent(
							new KeyboardEvent(down ? "keydown" : "keyup", {
								code: `Key${key.toUpperCase()}`,
							}),
						);
				};

				return new Promise<void>((resolve) => {
					let held: string[] = [];
					// Closest approach so far, so a walk that has stopped closing
					// the distance can end once the caller's click can reach.
					let best = Number.POSITIVE_INFINITY;
					let noProgress = 0;
					let lastX = Number.NaN;
					let lastY = Number.NaN;
					let finished = false;
					let observer: MutationObserver | null = null;
					let pulse: ReturnType<typeof setInterval> | null = null;
					let bell: ReturnType<typeof setTimeout> | null = null;

					const finish = () => {
						if (finished) return;
						finished = true;
						send(held, false);
						held = [];
						observer?.disconnect();
						if (pulse !== null) clearInterval(pulse);
						if (bell !== null) clearTimeout(bell);
						resolve();
					};

					const step = () => {
						if (finished) return;
						const pos = read();
						if (!pos) return;
						const dx = worldX - pos.x;
						const dy = worldY - pos.y;
						const distance = Math.hypot(dx, dy);
						// Released in this same turn, before the next game frame
						// can carry the player past the target.
						if (distance <= tolerance) return finish();
						// Ignore repeated reads of an unchanged position: a slow
						// frame loop must not look like a stalled walk.
						const moved = pos.x !== lastX || pos.y !== lastY;
						if (moved) {
							lastX = pos.x;
							lastY = pos.y;
							if (distance < best - 1) {
								best = distance;
								noProgress = 0;
							} else {
								noProgress += 1;
							}
						}
						if (noProgress > stallLimit && distance <= reach) return finish();
						const wanted: string[] = [];
						if (Math.abs(dx) > deadband) wanted.push(dx > 0 ? "d" : "a");
						if (Math.abs(dy) > deadband) wanted.push(dy > 0 ? "s" : "w");
						if (wanted.length === 0) return finish();
						const added = wanted.filter((key) => !held.includes(key));
						const dropped = held.filter((key) => !wanted.includes(key));
						if (dropped.length) send(dropped, false);
						if (added.length) send(added, true);
						held = wanted;
					};

					observer = new MutationObserver(step);
					observer.observe(root, {
						attributes: true,
						attributeFilter: ["data-player-x", "data-player-y"],
					});
					// Re-assert the hold so a keydown dropped while a scene was
					// paused cannot strand the player, and keep steering when the
					// position stops being republished (blocked or starved).
					pulse = setInterval(() => {
						if (finished) return;
						send(held, true);
						step();
					}, resendMs);
					bell = setTimeout(finish, timeout);
					step();
				});
			},
			{
				worldX,
				worldY,
				tolerance,
				reach,
				timeout,
				resendMs: WALK_RESEND_MS,
				deadband: WALK_DEADBAND,
				stallLimit: WALK_STALL_LIMIT,
			},
		);
	} finally {
		// A rejected walk (a navigation mid-walk, a closed page) must not leave
		// a movement key held down for whatever the test does next.
		await page
			.evaluate(() => {
				for (const key of ["a", "d", "w", "s"])
					window.dispatchEvent(
						new KeyboardEvent("keyup", { code: `Key${key.toUpperCase()}` }),
					);
			})
			.catch(() => {});
	}
}
