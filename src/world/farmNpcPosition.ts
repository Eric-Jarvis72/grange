/** Pure placement rules for the farmhand, kept free of Excalibur imports. */

/** Where the farmhand stands relative to the farmhouse prop's base. */
export const FARM_NPC_OFFSET = { x: 145, y: 40 } as const;
/** How close the owner must stand to open his trade window. */
export const FARM_NPC_REACH = 90;
export const FARM_NPC_NAME = "Walt";

export interface NpcAnchor {
	x: number;
	y: number;
}

/** The farmhand's spot for a farmhouse position, or null when it is packed up. */
export function npcAnchor(house: NpcAnchor | null): NpcAnchor | null {
	if (!house) return null;
	return {
		x: house.x + FARM_NPC_OFFSET.x,
		y: house.y + FARM_NPC_OFFSET.y,
	};
}

/** The talk prompt when the player stands close enough, else null. */
export function npcPrompt(
	player: NpcAnchor,
	npc: NpcAnchor | null,
): string | null {
	if (!npc) return null;
	const distance = Math.hypot(player.x - npc.x, player.y - npc.y);
	return distance <= FARM_NPC_REACH
		? `Press E or Enter to talk to ${FARM_NPC_NAME}`
		: null;
}
