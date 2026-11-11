import type * as ex from "excalibur";
import type { EmoteId } from "../../shared/emotes";

/**
 * Per-actor emote playback state.
 *
 * Kept in a WeakMap so an emote can temporarily own an actor's graphic without
 * changing every call site that calls `updateFarmerGraphics`. An emote loops
 * until movement or an action clears it.
 */
const active = new WeakMap<ex.Actor, EmoteId>();

export function startEmote(actor: ex.Actor, id: EmoteId): void {
	active.set(actor, id);
}

/** Returns the emote still playing on `actor`, or null. */
export function activeEmote(actor: ex.Actor): EmoteId | null {
	return active.get(actor) ?? null;
}

export function clearEmote(actor: ex.Actor): void {
	active.delete(actor);
}
