import {
	COMBO_SWAP_GRACE_MS,
	COMBO_WINDOW_MS,
	type ComboPerks,
	comboPerks,
} from "../../shared/mechanics";

/** The valid grid actions that keep a combo alive. */
export type ComboAction = "till" | "plant" | "water" | "harvest";

/**
 * Arcade combo chain for active farming chores. Pure and time-injected so the
 * scene can drive it from `onPreUpdate` and tests can advance a fake clock.
 */
export class ComboTracker {
	private count = 0;
	private expiresAt = 0;
	private lastAction: ComboAction | null = null;
	private swapPending = false;

	/** Call when the active hotbar slot changes. */
	noteHotbarSwap(): void {
		this.swapPending = true;
	}

	/**
	 * Records a valid grid change. The first action after a hotbar swap that
	 * differs from the previous action earns the one-time grace window.
	 */
	register(action: ComboAction, now: number = Date.now()): number {
		const grace =
			this.swapPending && this.lastAction !== null && this.lastAction !== action
				? COMBO_SWAP_GRACE_MS
				: 0;
		this.swapPending = false;
		this.lastAction = action;
		this.count += 1;
		this.expiresAt = now + COMBO_WINDOW_MS + grace;
		return this.count;
	}

	/** Adds a flat bonus (e.g. Midas Wheat's +3) and refreshes the window. */
	add(count: number, now: number = Date.now()): number {
		if (count <= 0) return this.count;
		this.count += count;
		this.expiresAt = Math.max(this.expiresAt, now + COMBO_WINDOW_MS);
		return this.count;
	}

	/** Drops the combo once its window lapses. Returns the live count. */
	update(now: number = Date.now()): number {
		if (this.count > 0 && now > this.expiresAt) this.reset();
		return this.count;
	}

	get current(): number {
		return this.count;
	}

	get expiresAtMs(): number {
		return this.expiresAt;
	}

	perks(): ComboPerks {
		return comboPerks(this.count);
	}

	reset(): void {
		this.count = 0;
		this.expiresAt = 0;
		this.lastAction = null;
		this.swapPending = false;
	}
}
