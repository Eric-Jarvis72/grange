import type * as ex from "excalibur";
import { bankResources } from "./bankResources";
import { casinoResources } from "./casinoResources";
import { farmerImage } from "./farmerSprite";
import { livestockResources } from "./livestockResources";
import { marketplaceResources } from "./marketplaceResources";
import {
	resources,
	smokeImages,
	terrainImage,
	trainFrameImages,
	trainImage,
	trainTracksImage,
} from "./resources";
import { sprinklerResources } from "./sprinklerResources";
import type { WorldSceneName } from "./WalkingScene";

function unique(groups: ex.ImageSource[][]): ex.ImageSource[] {
	return [...new Set(groups.flat())];
}

/**
 * Per-scene image sets.
 *
 * Every world boot used to await all five scenes (~100 images, 9 MB) before it
 * could draw a single frame, so a farm visit paid for the casino's art and vice
 * versa. Scenes now load only what they draw, and the rest stream in behind the
 * first frame (see `preloadWorldResources`).
 */
const farmAssets = unique([resources, sprinklerResources]);

/** The shared player sprite every scene draws. */
const avatarAssets = [farmerImage];

/** The marketplace reuses the meadow tilesheet and the animated train. */
const marketplaceAssets = unique([
	avatarAssets,
	[
		terrainImage,
		trainImage,
		trainTracksImage,
		...trainFrameImages,
		...smokeImages,
	],
	marketplaceResources,
]);

const sceneAssets: Record<WorldSceneName, ex.ImageSource[]> = {
	"farm-map": farmAssets,
	marketplace: marketplaceAssets,
	casino: unique([avatarAssets, casinoResources]),
	"livestock-market": unique([avatarAssets, livestockResources]),
	bank: unique([avatarAssets, bankResources]),
};

const pendingScenes = new Map<WorldSceneName, Promise<void>>();
/** One load per image, shared across scenes (the farmer, train, terrain). */
const pendingImages = new Map<ex.ImageSource, Promise<void>>();

function loadImage(source: ex.ImageSource): Promise<void> {
	const cached = pendingImages.get(source);
	if (cached) return cached;

	const loading = source
		.load()
		.then(() => undefined)
		.catch((error: unknown) => {
			pendingImages.delete(source);
			throw error;
		});
	pendingImages.set(source, loading);
	return loading;
}

/**
 * Resolves once every image the scene draws has loaded.
 *
 * Images are module singletons, so the per-image cache makes repeated calls
 * (every travel, every engine remount) free. A failed load clears its cache
 * entry so a retry can try again.
 */
export function ensureSceneResources(scene: WorldSceneName): Promise<void> {
	const cached = pendingScenes.get(scene);
	if (cached) return cached;

	const loading = Promise.all(sceneAssets[scene].map(loadImage))
		.then(() => undefined)
		.catch((error: unknown) => {
			pendingScenes.delete(scene);
			throw error;
		});
	pendingScenes.set(scene, loading);
	return loading;
}

/**
 * Warms the scenes the player has not entered yet, in the background.
 *
 * Failures are intentionally swallowed: the foreground `ensureSceneResources`
 * call on travel retries and surfaces the error to the player, and a missing
 * optional image must not break the scene that already loaded.
 */
export function preloadWorldResources(except?: WorldSceneName): void {
	for (const scene of Object.keys(sceneAssets) as WorldSceneName[]) {
		if (scene === except) continue;
		void ensureSceneResources(scene).catch(() => undefined);
	}
}
