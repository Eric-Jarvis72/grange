/** A position in world pixels. */
export interface Point {
	x: number;
	y: number;
}

/** How quickly a remote avatar closes the gap to its last reported position. */
export const REMOTE_LERP_RATE = 12;

/** Beyond this gap (a respawn or reconnect) the avatar snaps instead. */
export const REMOTE_SNAP_DISTANCE = 250;

/** True once an avatar has moved enough to count as walking. */
const MOVE_EPSILON = 0.2;

/**
 * Eases `current` toward `target`. Frame-rate independent: `deltaMs` may be
 * clamped or variable without changing the feel.
 */
export function remoteStep(
	current: Point,
	target: Point,
	deltaMs: number,
	rate = REMOTE_LERP_RATE,
): Point {
	const blend = 1 - Math.exp((-rate * Math.max(0, deltaMs)) / 1000);
	return {
		x: current.x + (target.x - current.x) * blend,
		y: current.y + (target.y - current.y) * blend,
	};
}

/** Whether a remote avatar should teleport instead of sliding. */
export function shouldSnap(
	current: Point,
	target: Point,
	distance = REMOTE_SNAP_DISTANCE,
): boolean {
	return Math.hypot(target.x - current.x, target.y - current.y) > distance;
}

/** Unit signs of travel, for the shared farmer walk animation. */
export function remoteDirection(
	previous: Point,
	next: Point,
): { x: number; y: number } {
	const dx = next.x - previous.x;
	const dy = next.y - previous.y;
	if (Math.hypot(dx, dy) <= MOVE_EPSILON) return { x: 0, y: 0 };
	return { x: Math.sign(dx), y: Math.sign(dy) };
}
