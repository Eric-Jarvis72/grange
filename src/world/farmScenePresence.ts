import type * as ex from "excalibur";
import { useGameStore } from "../store";
import { FarmBonk } from "./farmBonk";
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
	private readonly bonk: FarmBonk;

	constructor(
		scene: ex.Scene,
		private readonly local: ex.Actor,
		report: (text: string) => void,
	) {
		const name = useGameStore.getState().username || "Farmer";
		this.players = new HubPlayers(scene, local, name);
		this.bonk = new FarmBonk(scene, report);
	}

	update(delta: number): void {
		this.players.sync(getFarmPeers());
		this.players.update(delta);
		this.bonk.update(delta);
		publishFarmPosition(this.local.pos.x, this.local.pos.y);
	}

	/** True when the shovel click landed on another visitor. */
	bonkAt(x: number, y: number): boolean {
		const target = this.players.bonkAt(x, y);
		if (!target) return false;
		this.bonk.play(target);
		return true;
	}

	clear(): void {
		this.players.clear();
		this.bonk.clear();
	}
}
