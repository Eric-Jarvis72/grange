import type { HorseColor } from "./horseResources";

export interface HorseSpawn {
	color: HorseColor;
	/** Home point the horse wanders around. */
	x: number;
	y: number;
	/** Radius of the roam circle around home, in world pixels. */
	roam: number;
}

/** The three farm horses graze in the open grass clear of the tilled field:
 * two beside the barn on the right, one by the farmhouse on the left. */
export const HORSE_SPAWNS: readonly HorseSpawn[] = [
	{ color: "blackhorse", x: 890, y: 470, roam: 110 },
	{ color: "pintohorse", x: 1060, y: 495, roam: 85 },
	{ color: "whitehorse", x: 170, y: 540, roam: 100 },
];
