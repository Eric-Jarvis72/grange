import * as ex from "excalibur";
import type { HubPeer } from "../../shared/types";
import { depthForY } from "./depth";
import { addFarmerGraphics, updateFarmerGraphics } from "./farmerSprite";
import { remoteDirection, remoteStep, shouldSnap } from "./hubInterpolation";

/** Space between the avatar's feet and the bottom of its name label. */
const LABEL_OFFSET_Y = 70;

interface RemoteAvatar {
	actor: ex.Actor;
	label: ex.Actor;
	target: { x: number; y: number };
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
		this.selfLabel = createLabel(localName);
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
			const before = { x: actor.pos.x, y: actor.pos.y };
			const next = shouldSnap(before, remote.target)
				? remote.target
				: remoteStep(before, remote.target, deltaMs);

			actor.pos.x = next.x;
			actor.pos.y = next.y;
			actor.z = depthForY(next.y);
			updateFarmerGraphics(actor, remoteDirection(before, next));
			this.placeLabel(remote.label, actor.pos, actor.z);
		}
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

		const label = createLabel(peer.name);
		this.scene.add(label);
		this.placeLabel(label, actor.pos, actor.z);

		return { actor, label, target: { x: peer.x, y: peer.y } };
	}

	private placeLabel(label: ex.Actor, pos: ex.Vector, z: number): void {
		label.pos.x = pos.x;
		label.pos.y = pos.y - LABEL_OFFSET_Y;
		label.z = z + 1;
	}
}

function createLabel(text: string): ex.Actor {
	const font = new ex.Font({
		size: 16,
		family: '"Rye", serif',
		textAlign: ex.TextAlign.Center,
		shadow: {
			blur: 2,
			offset: ex.vec(1, 2),
			color: ex.Color.fromHex("#241208"),
		},
	});
	const label = new ex.Actor({
		pos: ex.vec(0, 0),
		anchor: ex.vec(0.5, 1),
		z: 0,
	});
	label.graphics.use(
		new ex.Text({ text, font, color: ex.Color.fromHex("#fff4d6") }),
	);
	return label;
}
