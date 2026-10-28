import * as ex from "excalibur";

/** The three horse coats that ship with the game. */
export const HORSE_COLORS = ["blackhorse", "pintohorse", "whitehorse"] as const;

export type HorseColor = (typeof HORSE_COLORS)[number];

export interface HorseArt {
	/** Single standing pose, facing right. */
	idle: ex.ImageSource;
	/** Four-frame walk cycle, facing right. */
	walk: ex.ImageSource;
}

const horseImage = (file: string): ex.ImageSource =>
	new ex.ImageSource(`/assets/horse/${file}.png`, {
		filtering: ex.ImageFiltering.Pixel,
	});

/**
 * Each coat ships an idle pose and a walk strip facing right. The walk strips
 * are the `_animations` art repacked by `prepare_horses.py` into uniform cells
 * with the facing-right pose only; the companion `_facingleft` /
 * `_leftanimations` files are the same artwork mirrored with the walk frames
 * reversed, so the renderer flips the right-facing art at runtime instead of
 * loading duplicate copies.
 */
export const horseArt: Record<HorseColor, HorseArt> = {
	blackhorse: {
		idle: horseImage("blackhorse_facingright"),
		walk: horseImage("blackhorse_walk"),
	},
	pintohorse: {
		idle: horseImage("pintohorse_facingright"),
		walk: horseImage("pintohorse_walk"),
	},
	whitehorse: {
		idle: horseImage("whitehorse_facingright"),
		walk: horseImage("whitehorse_walk"),
	},
};

/** Every horse image the engine must preload. */
export const horseResources: ex.ImageSource[] = Object.values(horseArt).flatMap(
	(art) => [art.idle, art.walk],
);

/** Placeholder square drawn over each horse until real art is supplied. */
export const placeholderSquareImage = new ex.ImageSource(
	"/assets/horse/placeholder-square.png",
	{ filtering: ex.ImageFiltering.Pixel },
);
