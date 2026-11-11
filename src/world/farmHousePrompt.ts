import type * as ex from "excalibur";
import type { FarmPropLayer } from "./farmPropLayer";
import { FARM_HOUSE_REACH } from "./mapData";

/** The farmhouse "press E" prompt, or null when out of reach / not the owner. */
export function farmHousePrompt(
	isOwner: boolean,
	farmProps: FarmPropLayer,
	player: ex.Vector,
): string | null {
	if (!isOwner) return null;
	const house = farmProps.position("farmhouse");
	if (!house) return null;
	const distance = Math.hypot(player.x - house.x, player.y - house.y);
	return distance <= FARM_HOUSE_REACH
		? "Press E or Enter to enter the farmhouse"
		: null;
}
