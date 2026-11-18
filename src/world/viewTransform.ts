import type * as ex from "excalibur";

/** Last transform written per canvas, so this stays a no-op on idle frames. */
const published = new WeakMap<HTMLCanvasElement, string>();

/**
 * Publishes the camera's world-to-page transform on the canvas for e2e.
 *
 * The canvas fills the browser, so a page coordinate is no longer a simple
 * fraction of the map: the camera may be panned, and indoor rooms zoom to
 * cover. Specs read these attributes instead of assuming a fixed layout.
 */
export function publishViewTransform(
	engine: ex.Engine,
	camera: ex.Camera,
): void {
	const canvas = engine.canvas;
	const width = engine.drawWidth;
	const height = engine.drawHeight;
	const left = camera.pos.x - width / 2;
	const top = camera.pos.y - height / 2;
	const key = `${left}|${top}|${width}|${height}`;
	if (published.get(canvas) === key) return;
	published.set(canvas, key);
	canvas.dataset.viewLeft = `${left}`;
	canvas.dataset.viewTop = `${top}`;
	canvas.dataset.viewWidth = `${width}`;
	canvas.dataset.viewHeight = `${height}`;
}
