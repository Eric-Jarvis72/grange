import type { FarmReadyTile } from "../shared/farm";
import type { InMemoryFarmStore } from "./farm";

export interface FarmTickerOptions {
	intervalMs?: number;
	now?: () => number;
}

export function startFarmTicker(
	store: InMemoryFarmStore,
	onReady: (ready: FarmReadyTile[]) => void,
	opts: FarmTickerOptions = {},
): () => void {
	const intervalMs = opts.intervalMs ?? 1000;
	const now = opts.now ?? (() => Date.now());
	const timer = setInterval(() => {
		const ready = store.tickFarm(now());
		if (ready.length > 0) onReady(ready);
	}, intervalMs);
	return () => clearInterval(timer);
}
