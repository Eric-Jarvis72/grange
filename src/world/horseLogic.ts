/** Which way a horse is drawn. The side-on art only has two poses, so vertical
 * travel reuses whichever horizontal facing the horse last had. */
export type HorseFacing = "left" | "right";

export interface WanderBounds {
	left: number;
	right: number;
	top: number;
	bottom: number;
}

export interface Point {
	x: number;
	y: number;
}

export interface SourceView {
	x: number;
	y: number;
	width: number;
	height: number;
}

export const clamp = (value: number, min: number, max: number): number =>
	Math.min(Math.max(value, min), max);

/** Face the way the horse is travelling, but keep the previous facing when it
 * moves straight up or down (there is no vertical pose to switch to). */
export function facingFor(current: HorseFacing, dx: number): HorseFacing {
	if (dx < 0) return "left";
	if (dx > 0) return "right";
	return current;
}

/** A random point inside the horse's roam circle, clamped to its bounds.
 * Sampling with `sqrt` keeps the pick uniform across the whole disc instead of
 * clustering at the centre. */
export function pickWanderTarget(
	home: Point,
	roam: number,
	bounds: WanderBounds,
	random: () => number = Math.random,
): Point {
	const angle = random() * Math.PI * 2;
	const distance = Math.sqrt(random()) * roam;
	return {
		x: clamp(home.x + Math.cos(angle) * distance, bounds.left, bounds.right),
		y: clamp(home.y + Math.sin(angle) * distance, bounds.top, bounds.bottom),
	};
}

const IDLE_MIN_MS = 900;
const IDLE_MAX_MS = 3_200;

/** How long an idle horse waits before it sets off again, in milliseconds. */
export function idleDuration(random: () => number = Math.random): number {
	return IDLE_MIN_MS + random() * (IDLE_MAX_MS - IDLE_MIN_MS);
}

/** Splits a horizontal strip into `count` evenly spaced source rectangles that
 * tile the full width with no gaps or overlaps. */
export function frameSourceViews(
	width: number,
	height: number,
	count: number,
): SourceView[] {
	const views: SourceView[] = [];
	for (let index = 0; index < count; index += 1) {
		const left = Math.round((width * index) / count);
		const right = Math.round((width * (index + 1)) / count);
		views.push({ x: left, y: 0, width: right - left, height });
	}
	return views;
}

/** Index of the point closest to `origin` that lies within `maxDistance`, or
 * -1 when none are in range. Ties keep the earliest point. */
export function nearestWithin(
	origin: Point,
	points: readonly Point[],
	maxDistance: number,
): number {
	let best = -1;
	let bestDistance = maxDistance;
	for (let index = 0; index < points.length; index += 1) {
		const distance = Math.hypot(
			points[index].x - origin.x,
			points[index].y - origin.y,
		);
		if (distance <= bestDistance) {
			bestDistance = distance;
			best = index;
		}
	}
	return best;
}
