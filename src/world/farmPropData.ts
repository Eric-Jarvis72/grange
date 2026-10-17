import type { ActiveFarm } from "../../shared/types";
import { isMovablePropAsset, props, type MapProp, type MovablePropKey } from "./mapData";

export interface PlacedFarmProp extends MapProp { index: number }
type Override = ActiveFarm["prop_overrides"][number];

/** Apply per-farm overrides to the shared starter layout; the train stays fixed. */
export function placedFarmProps(overrides: Override[]): PlacedFarmProp[] {
	const byIndex = new Map(overrides.map((change) => [change.index, change]));
	return props.flatMap((original, index) => {
		const change = byIndex.get(index);
		if (!change || original.asset === "starter-train" || change.asset !== original.asset)
			return [{ ...original, index }];
		if (change.carried) return [];
		return [{ ...original, x: change.x, y: change.y, index }];
	});
}

export function movablePropAt(index: number): MovablePropKey | null {
	const asset = props[index]?.asset;
	return asset && isMovablePropAsset(asset) ? asset : null;
}
