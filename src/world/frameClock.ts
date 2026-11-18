/**
 * Wall-clock step for gameplay movement and travel animations.
 *
 * Excalibur's clock throws away any frame longer than 200ms and reports 1ms
 * instead, which drops the whole world into slow motion on a loaded machine
 * (a busy CI runner painting two canvases runs at ~7fps, so a one second walk
 * becomes a minute). Movement, collision steps and the train all advance with
 * this value instead, so a slow frame covers the time it actually took.
 *
 * At normal frame rates this is identical to the engine's delta: Excalibur
 * only rewrites frames above 200ms.
 */

/**
 * Longest step we ever take. Also the per-frame movement clamp in
 * `playerMovement.ts`, so a stalled tab cannot teleport the player through a
 * wall.
 */
export const MAX_FRAME_STEP_MS = 100;

/**
 * Tracks the time since the last step. One instance per world scene: a scene
 * may call `step()` once per frame and pass the value to everything that
 * needs it.
 */
export class FrameClock {
	private last: number;

	constructor(now: number = performance.now()) {
		this.last = now;
	}

	/** Milliseconds since the previous step, clamped to `[0, MAX_FRAME_STEP_MS]`. */
	step(now: number = performance.now()): number {
		// A broken or backwards timestamp must not poison the clock.
		if (!Number.isFinite(now)) return 0;
		const elapsed = now - this.last;
		if (elapsed <= 0) return 0;
		this.last = now;
		return Math.min(elapsed, MAX_FRAME_STEP_MS);
	}

	/** Drops any backlog, e.g. after a menu pause or a scene switch. */
	reset(now: number = performance.now()): void {
		this.last = now;
	}
}
