/** The world scene a train trip should land in. */
export type TrainArrivalScene = "farm-map" | "marketplace";

let pending: TrainArrivalScene | null = null;

/** Marks the scene the next world mount should activate (and animate into). */
export function markTrainArrival(scene: TrainArrivalScene = "farm-map"): void {
	pending = scene;
}

/** Reads and clears the one-shot arrival destination. */
export function consumeTrainArrival(): TrainArrivalScene | null {
	const value = pending;
	pending = null;
	return value;
}

/**
 * Reads the pending arrival without clearing it.
 *
 * The world uses this to pick the scene whose artwork blocks its first frame;
 * only the active engine run consumes the flag, so React's double-mounted
 * effects cannot spend it on the wrong mount.
 */
export function peekTrainArrival(): TrainArrivalScene | null {
	return pending;
}
