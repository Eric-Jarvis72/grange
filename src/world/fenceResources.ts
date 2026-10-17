import * as ex from "excalibur";

const fenceImage = (name: string) => new ex.ImageSource(
	`/assets/farm/fences/${name}.webp`,
	{ filtering: ex.ImageFiltering.Pixel },
);

export const fenceImages = {
	post: fenceImage("post"),
	"rail-horizontal": fenceImage("rail-horizontal"),
	"rail-vertical": fenceImage("rail-vertical"),
};

// Prepared but not placed: a future gate can replace one fence edge.
export const fenceGateImages = {
	"closed-horizontal": fenceImage("gate-closed-horizontal"),
	"open-horizontal": fenceImage("gate-open-horizontal"),
	"closed-vertical": fenceImage("gate-closed-vertical"),
	"open-vertical": fenceImage("gate-open-vertical"),
};

export const fenceResources = [
	...Object.values(fenceImages),
	...Object.values(fenceGateImages),
];
