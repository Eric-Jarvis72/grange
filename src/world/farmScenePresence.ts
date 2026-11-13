import type * as ex from "excalibur";
import { useGameStore } from "../store";
import { getFarmPeers, publishFarmPosition } from "./farmPresence";
import { HubPlayers } from "./hubPlayers";

/**
 * Renders the other visitors on a farm and reports the local position.
 *
 * Farm presence is cosmetic, exactly like hub presence: remote avatars are not
 * part of collision or tool handling, and they ease toward the last reported
 * position instead of being simulated.
 */
export class FarmScenePresence {
	private readonly players: HubPlayers;

	constructor(scene: ex.Scene, private readonly local: ex.Actor) {
		const name = useGameStore.getState().username || "Farmer";
		this.players = new HubPlayers(scene, local, name);
	}

	update(delta: number): void {
		this.players.sync(getFarmPeers());
		this.players.update(delta);
		publishFarmPosition(this.local.pos.x, this.local.pos.y);
	}

	clear(): void {
		this.players.clear();
	}
}
