import { image } from "./resources";

/** Composite sprite used for the drag preview ghost. */
export const sprinklerImage = image("farm/objects/sprinkler.webp");
/** The static green base and the spinning brass rotor are drawn separately. */
export const sprinklerBaseImage = image("farm/objects/sprinkler-base.webp");
export const sprinklerRotorImage = image("farm/objects/sprinkler-rotor.webp");
/** Spray effect shown while the rotor spins. */
export const sprinklerWaterImage = image("farm/objects/sprinkler-water.webp");
export const sprinklerResources = [
	sprinklerImage,
	sprinklerBaseImage,
	sprinklerRotorImage,
	sprinklerWaterImage,
];
