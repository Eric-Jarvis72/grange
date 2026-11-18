/** The furthest a player may stand from something to interact with it. */
export const MAX_INTERACTION_DISTANCE = 96;

/** True when the player is close enough to reach `target`. */
export function withinInteractionRange(
	player: { x: number; y: number },
	target: { x: number; y: number },
	max = MAX_INTERACTION_DISTANCE,
): boolean {
	return Math.hypot(player.x - target.x, player.y - target.y) <= max;
}

/** Publishes the player's HUD position and gates interactions by reach. */
export class PlayerReach {
	private last: { x: number; y: number } | null = null;

	constructor(private readonly report: (message: string) => void) {}

	/** True on the first call and whenever the player moves `threshold` px. */
	moved(pos: { x: number; y: number }, threshold = 8): boolean {
		if (
			this.last &&
			Math.abs(pos.x - this.last.x) < threshold &&
			Math.abs(pos.y - this.last.y) < threshold
		)
			return false;
		this.last = { x: pos.x, y: pos.y };
		return true;
	}

	/** Reports and returns true when `target` is out of the player's reach. */
	blocked(
		player: { x: number; y: number },
		target: { x: number; y: number },
	): boolean {
		if (withinInteractionRange(player, target)) return false;
		this.report("Too far away to reach that.");
		return true;
	}
}
