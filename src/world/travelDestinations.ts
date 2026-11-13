import type { FarmSummary } from "../../shared/types";

/** Where the local player is standing when they board the train. */
export type TrainLocation =
	| { kind: "farm"; owner: string }
	| { kind: "marketplace" };

/** One row in the train destination menu. */
export interface TravelDestination {
	id: string;
	label: string;
	detail?: string;
	kind: "marketplace" | "home" | "farm";
	owner?: string;
}

/**
 * Builds the train menu for the current location.
 *
 * Own farm: marketplace + open farms.
 * Marketplace: your farm + open farms.
 * Guest farm: your farm + marketplace + other open farms.
 */
export function trainDestinations(
	location: TrainLocation,
	farms: FarmSummary[],
	username: string,
): TravelDestination[] {
	const open = farms
		.filter((farm) => farm.is_public && farm.owner !== username)
		.sort((a, b) => a.owner.localeCompare(b.owner));
	const current = location.kind === "farm" ? location.owner : null;
	const destinations: TravelDestination[] = [];
	const visiting = current !== null && current !== username;

	if (visiting) destinations.push(homeDestination());
	if (visiting || current !== null) destinations.push(marketplaceDestination());

	for (const farm of open) {
		if (farm.owner === current) continue;
		destinations.push(farmDestination(farm));
	}

	if (location.kind === "marketplace") destinations.unshift(homeDestination());

	return destinations;
}

export function homeDestination(): TravelDestination {
	return { id: "home", label: "Your Farm", kind: "home" };
}

export function marketplaceDestination(): TravelDestination {
	return {
		id: "marketplace",
		label: "Marketplace",
		detail: "Shops, bank, livestock, and casino",
		kind: "marketplace",
	};
}

function farmDestination(farm: FarmSummary): TravelDestination {
	return {
		id: `farm-${farm.owner}`,
		label: `${farm.owner}'s Farm`,
		detail: `${farm.planted} growing · ${farm.ready} ready`,
		kind: "farm",
		owner: farm.owner,
	};
}
