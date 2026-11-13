import type { ItemId } from "../inventory/items";
import { isMovablePropAsset } from "./mapData";

/**
 * Whether a click should open barn storage rather than run the held tool.
 * Digging with the shovel and placing a movable prop keep priority, so the
 * barn stays an ordinary placeable object.
 */
export function opensBarn(
	isOwner: boolean,
	item: ItemId | null,
	asset: string | undefined,
): boolean {
	if (!isOwner || asset !== "barn") return false;
	if (item === "shovel") return false;
	return item === null || !isMovablePropAsset(item);
}

/** How far past the barn's sprite the player can stand and still interact. */
export const BARN_REACH = 48;

/**
 * Whether the player is close enough to the barn for its interact prompt. The
 * barn blocks movement, so the player can only ever stand at its edge; the
 * margin keeps the prompt forgiving from any approach.
 */
export function withinBarnReach(
	player: { x: number; y: number },
	barn: { x: number; y: number; width: number; height: number },
	margin = BARN_REACH,
): boolean {
	return (
		player.x >= barn.x - barn.width / 2 - margin &&
		player.x <= barn.x + barn.width / 2 + margin &&
		player.y >= barn.y - barn.height - margin &&
		player.y <= barn.y + margin
	);
}
