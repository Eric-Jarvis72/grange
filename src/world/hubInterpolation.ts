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

/** How long a bonked avatar wobbles before settling back to its walk cycle. */
export const BONK_DURATION_MS = 420;

/** Peak sideways knockback in world pixels. */
export const BONK_KNOCKBACK = 16;

/** Offset and tilt applied to a remote avatar after a shovel hit. */
export interface BonkPose {
	offsetX: number;
	rotation: number;
}

/**
 * Decaying knockback and a comic wobble for a shovel bonk.
 *
 * The pose starts at rest, kicks away from the attacker, then rings down to
 * zero once `BONK_DURATION_MS` has elapsed. Pure so the reaction is testable.
 */
export function bonkPose(elapsedMs: number, direction: number): BonkPose {
	const t = Math.min(1, Math.max(0, elapsedMs / BONK_DURATION_MS));
	if (t >= 1) return { offsetX: 0, rotation: 0 };
	const sign = direction < 0 ? -1 : 1;
	const kick = Math.sin(Math.min(1, t / 0.18) * (Math.PI / 2));
	const settle = 1 - t;
	const wobble = Math.sin(t * Math.PI * 3) * settle * settle;
	return {
		offsetX: sign * BONK_KNOCKBACK * kick * settle,
		rotation: sign * 0.24 * wobble,
	};
}

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
