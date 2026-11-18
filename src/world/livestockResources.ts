import type * as ex from "excalibur";
import { image } from "./resources";
import type { AnimalId } from "./livestockData";

const livestockBase = "marketplace/livestock";
export const livestockInteriorImage = image(`${livestockBase}/interior.webp`);
export const livestockPenImage = image(`${livestockBase}/pen.webp`);
export const livestockTroughImage = image(`${livestockBase}/trough.webp`);

export const livestockAnimalImages: Record<AnimalId, ex.ImageSource> = {
	cow: image("farm/animals/cow/idle-01.webp"),
	hen: image("farm/animals/hen/idle-01.webp"),
	sheep: image("farm/animals/sheep/idle-01.webp"),
	pig: image("farm/animals/pig/idle-01.webp"),
};

/** Every livestock species has the same four split animation states. */
export const animalAnimationFrames = Object.fromEntries(
	(Object.keys(livestockAnimalImages) as AnimalId[]).map((animal) => [animal, {
		idle: [livestockAnimalImages[animal], image(`farm/animals/${animal}/idle-02.webp`)],
		walk: [1, 2, 3, 4].map((n) => image(`farm/animals/${animal}/walk-0${n}.webp`)),
		feed: [1, 2, 3, 4].map((n) => image(`farm/animals/${animal}/feed-0${n}.webp`)),
		rest: [1, 2].map((n) => image(`farm/animals/${animal}/rest-0${n}.webp`)),
	}]),
) as Record<AnimalId, Record<"idle" | "walk" | "feed" | "rest", ex.ImageSource[]>>;

export const animalAnimationResources = Object.values(animalAnimationFrames)
	.flatMap((states) => Object.values(states).flat());

export const livestockSignImages: Record<AnimalId, ex.ImageSource> = {
	cow: image(`${livestockBase}/cow-sign.webp`),
	hen: image(`${livestockBase}/hen-sign.webp`),
	sheep: image(`${livestockBase}/sheep-sign.webp`),
	pig: image(`${livestockBase}/pig-sign.webp`),
};

export const livestockResources = [
	livestockInteriorImage,
	livestockPenImage,
	livestockTroughImage,
	...Object.values(livestockAnimalImages),
	...Object.values(livestockSignImages),
];
