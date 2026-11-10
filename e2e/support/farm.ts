import { expect, type Page } from "@playwright/test";
import { MAP_COLUMNS, MAP_ROWS } from "../../src/world/mapData";

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

/** Clicks the center of a farm map tile. */
export async function clickFarmTile(
	page: Page,
	column: number,
	row: number,
): Promise<void> {
	const { x, y } = await farmTilePosition(page, column, row);
	await page.mouse.click(x, y);
}
