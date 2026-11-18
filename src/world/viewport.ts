/** Camera helpers for fitting a fixed-size world into an arbitrary browser. */

/**
 * Camera position on one axis that keeps `min..max` on screen around `target`.
 * When the view is wider than the world, the camera stays centred and the
 * leftover space shows the scene backdrop instead of pinning to one edge.
 */
export function cameraAxis(
	target: number,
	halfView: number,
	min: number,
	max: number,
): number {
	if (max - min <= halfView * 2) return (min + max) / 2;
	return Math.min(Math.max(target, min + halfView), max - halfView);
}
