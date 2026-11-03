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
