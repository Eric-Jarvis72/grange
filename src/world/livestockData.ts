import type { WalkObstacle } from "./walkCollisions";

export type AnimalId = "cow" | "hen" | "sheep" | "pig";

export interface LivestockPen {
	id: AnimalId;
	name: string;
	price: number;
	x: number;
	y: number;
	approachX: number;
	approachY: number;
	width: number;
	animalWidth: number;
}

/** Each pen opens toward the center aisle, leaving a clear route from the door. */
export const livestockPens: readonly LivestockPen[] = [
	{ id: "cow", name: "Cow", price: 120, x: 300, y: 365, approachX: 503, approachY: 295, width: 330, animalWidth: 105 },
	{ id: "hen", name: "Hen", price: 25, x: 852, y: 365, approachX: 649, approachY: 295, width: 330, animalWidth: 78 },
	{ id: "sheep", name: "Sheep", price: 70, x: 300, y: 565, approachX: 503, approachY: 495, width: 330, animalWidth: 105 },
	{ id: "pig", name: "Pig", price: 55, x: 852, y: 565, approachX: 649, approachY: 495, width: 330, animalWidth: 98 },
];

export const LIVESTOCK_EXIT = { x: 576, y: 645 } as const;
export const LIVESTOCK_SPAWN = { x: 576, y: 615 } as const;

/** The room walls and four enclosures are solid; the middle aisle remains free. */
export const livestockWalkObstacles: WalkObstacle[] = [
	{ left: 0, right: 1152, top: 0, bottom: 190 },
	{ left: 0, right: 88, top: 0, bottom: 768 },
	{ left: 1064, right: 1152, top: 0, bottom: 768 },
	{ left: 0, right: 1152, top: 700, bottom: 768 },
	...livestockPens.map((pen) => ({
		left: pen.x - pen.width / 2 + 8,
		right: pen.x + pen.width / 2 - 8,
		top: pen.y - 185,
		bottom: pen.y - 6,
	})),
];
