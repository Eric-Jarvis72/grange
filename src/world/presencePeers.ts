import { type Channel, Presence } from "phoenix";
import type { HubPeer } from "../../shared/types";
import { useGameStore } from "../store";

interface PresenceMeta {
	x?: unknown;
	y?: unknown;
	at?: unknown;
}

interface PresenceEntry {
	metas?: PresenceMeta[];
}

/**
 * Keeps a snapshot of the other players in one presence-enabled channel.
 *
 * Presence is keyed by username, so a second tab adds another meta under the
 * same key; the newest `at` wins and only one avatar is rendered per account.
 */
export class PresencePeers {
	private presence: Presence | null = null;
	private peers: HubPeer[] = [];
	private names = "";
	private readonly listeners = new Set<(names: string[]) => void>();

	get current(): HubPeer[] {
		return this.peers;
	}

	/** Starts listening to a joined (or joining) channel. */
	attach(channel: Channel): void {
		const presence = new Presence(channel);
		this.presence = presence;
		presence.onSync(() => {
			if (this.presence !== presence) return;
			this.setPeers(readPeers(presence));
		});
	}

	/** Forgets the channel and emits an empty peer list. */
	detach(): void {
		this.presence = null;
		this.setPeers([]);
	}

	/** Notifies when the set of peer names changes, not on every movement. */
	subscribe(listener: (names: string[]) => void): () => void {
		this.listeners.add(listener);
		listener(this.nameList());
		return () => {
			this.listeners.delete(listener);
		};
	}

	private setPeers(peers: HubPeer[]): void {
		this.peers = peers;
		const names = this.nameList();
		const key = names.join(",");
		if (key === this.names) return;
		this.names = key;
		for (const listener of this.listeners) listener(names);
	}

	private nameList(): string[] {
		return this.peers.map((peer) => peer.name).sort();
	}
}

/** Extracts visible peers from a Phoenix Presence snapshot. */
export function readPeers(presence: Presence): HubPeer[] {
	const self = useGameStore.getState().username;
	return presence
		.list((name: string, entry: PresenceEntry): HubPeer | null => {
			const meta = newestMeta(entry?.metas ?? []);
			if (!meta) return null;
			const x = typeof meta.x === "number" ? meta.x : null;
			const y = typeof meta.y === "number" ? meta.y : null;
			// Players are tracked before their first position report.
			if (x === null || y === null) return null;
			return { name, x, y };
		})
		.filter((peer): peer is HubPeer => peer !== null && peer.name !== self);
}

function newestMeta(metas: PresenceMeta[]): PresenceMeta | null {
	let newest: PresenceMeta | null = null;
	let newestAt = Number.NEGATIVE_INFINITY;
	for (const meta of metas) {
		const at = typeof meta.at === "number" ? meta.at : 0;
		if (at >= newestAt) {
			newestAt = at;
			newest = meta;
		}
	}
	return newest;
}
