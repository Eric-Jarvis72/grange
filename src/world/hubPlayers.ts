import * as ex from "excalibur";
import type { HubPeer } from "../../shared/types";
import { depthForY } from "./depth";
import { addFarmerGraphics, updateFarmerGraphics } from "./farmerSprite";
import {
	BONK_DURATION_MS,
	bonkPose,
	remoteDirection,
	remoteStep,
	shouldSnap,
} from "./hubInterpolation";
import { createNameLabel } from "./nameLabel";
import { peerHit } from "./peerHit";

/** Space between the avatar's feet and the bottom of its name label. */
const LABEL_OFFSET_Y = 70;

interface RemoteAvatar {
	actor: ex.Actor;
	label: ex.Actor;
	target: { x: number; y: number };
	/** Eased position without the bonk knockback applied. */
	base: { x: number; y: number };
	bonk: { elapsed: number; direction: number } | null;
}

/** A remote farmer under the pointer that can be bonked. */
export interface BonkTarget {
	name: string;
	x: number;
	y: number;
}

/**
 * Renders the other players in a hub area and the local player's own name.
 *
 * Remote avatars are owned by this helper: presence snapshots add/remove them,
 * and each frame eases them toward their last reported position so movement
 * looks smooth despite the ~10 Hz update rate.
 */
export class HubPlayers {
	private readonly remotes = new Map<string, RemoteAvatar>();
	private readonly selfLabel: ex.Actor;

	constructor(
		private readonly scene: ex.Scene,
		private readonly local: ex.Actor,
		localName: string,
	) {
		this.selfLabel = createNameLabel(localName);
		scene.add(this.selfLabel);
		this.placeLabel(this.selfLabel, local.pos, local.z);
	}

	/** Matches the rendered avatars to the latest presence snapshot. */
	sync(peers: HubPeer[]): void {
		const seen = new Set<string>();

		for (const peer of peers) {
			seen.add(peer.name);
			const existing = this.remotes.get(peer.name);
			if (existing) {
				existing.target = { x: peer.x, y: peer.y };
				continue;
			}
			this.remotes.set(peer.name, this.createRemote(peer));
		}

		for (const [name, remote] of this.remotes) {
			if (seen.has(name)) continue;
			remote.actor.kill();
			remote.label.kill();
			this.remotes.delete(name);
		}
	}

	/** Eases remotes toward their targets. Call once per frame. */
	update(deltaMs: number): void {
		this.selfLabel.pos.x = this.local.pos.x;
		this.selfLabel.pos.y = this.local.pos.y - LABEL_OFFSET_Y;
		this.selfLabel.z = this.local.z + 1;
		this.selfLabel.graphics.visible = this.local.graphics.visible;

		for (const remote of this.remotes.values()) {
			const actor = remote.actor;
			const before = remote.base;
			const next = shouldSnap(before, remote.target)
				? remote.target
				: remoteStep(before, remote.target, deltaMs);
			remote.base = next;

			if (remote.bonk) {
				remote.bonk.elapsed += deltaMs;
				if (remote.bonk.elapsed >= BONK_DURATION_MS) remote.bonk = null;
			}
			const pose = remote.bonk
				? bonkPose(remote.bonk.elapsed, remote.bonk.direction)
				: { offsetX: 0, rotation: 0 };

			actor.pos.x = next.x + pose.offsetX;
			actor.pos.y = next.y;
			actor.rotation = pose.rotation;
			actor.z = depthForY(next.y);
			updateFarmerGraphics(actor, remoteDirection(before, next));
			this.placeLabel(remote.label, actor.pos, actor.z);
		}
	}

	/**
	 * Bonks the remote avatar under a world point and returns it.
	 *
	 * Purely cosmetic: no farm or presence state changes. The knockback pushes
	 * the avatar away from the local player so the comic reaction reads even
	 * when the attacker clicks the victim's feet.
	 */
	bonkAt(x: number, y: number): BonkTarget | null {
		for (const [name, remote] of this.remotes) {
			if (!peerHit(remote.base, x, y)) continue;
			const away = remote.base.x - this.local.pos.x;
			remote.bonk = { elapsed: 0, direction: away < 0 ? -1 : 1 };
			return { name, x: remote.base.x, y: remote.base.y };
		}
		return null;
	}

	/** Removes every remote avatar; used when leaving the hub area. */
	clear(): void {
		for (const remote of this.remotes.values()) {
			remote.actor.kill();
			remote.label.kill();
		}
		this.remotes.clear();
	}

	private createRemote(peer: HubPeer): RemoteAvatar {
		const actor = new ex.Actor({
			pos: ex.vec(peer.x, peer.y),
			width: 32,
			height: 32,
			anchor: ex.vec(0.5, 1),
			z: depthForY(peer.y),
		});
		addFarmerGraphics(actor);
		this.scene.add(actor);

		const label = createNameLabel(peer.name);
		this.scene.add(label);
		this.placeLabel(label, actor.pos, actor.z);

		const base = { x: peer.x, y: peer.y };
		return { actor, label, target: { ...base }, base, bonk: null };
	}

	private placeLabel(label: ex.Actor, pos: ex.Vector, z: number): void {
		label.pos.x = pos.x;
		label.pos.y = pos.y - LABEL_OFFSET_Y;
		label.z = z + 1;
	}
}
