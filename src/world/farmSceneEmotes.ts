import type * as ex from "excalibur";
import type { EmoteId } from "../../shared/emotes";
import {
	clearLocalHandler,
	closeEmoteWheel,
	isEmoteWheelOpen,
	openEmoteWheel,
	setLocalHandler,
} from "../emotes/emoteStore";
import { publishEmote } from "./emoteClient";
import { clearEmote } from "./farmerEmoteState";
import { freezeFarmer } from "./farmerSprite";
import { playFarmerEmote } from "./farmerEmotes";
import type { InputManager } from "./InputManager";

/**
 * Owns the farm scene's local emote playback and the shared `T` toggle.
 *
 * Extracted from `FarmMapScene` so the scene stays under the file-size cap and
 * the hub/farm toggle rules live in one place.
 */
export class FarmEmotes {
	private handler: ((id: EmoteId) => void) | null = null;

	constructor(
		private readonly player: ex.Actor,
		private readonly canOpen: () => boolean,
	) {}

	attach(): void {
		const handler = (id: EmoteId) => {
			playFarmerEmote(this.player, id);
			publishEmote(id);
		};
		this.handler = handler;
		setLocalHandler(handler);
	}

	detach(): void {
		if (!this.handler) return;
		clearLocalHandler(this.handler);
		this.handler = null;
	}

	/** Consumes T, toggles the wheel, and reports whether input was used. */
	handle(input: InputManager): boolean {
		if (!input.consumePress("KeyT") || !this.canOpen()) return false;
		if (isEmoteWheelOpen()) closeEmoteWheel();
		else openEmoteWheel();
		input.clearHeld();
		freezeFarmer(this.player);
		return true;
	}

	/** Stops a looping emote when the player uses an action key. */
	cancelOnAction(input: InputManager): void {
		if (input.wasPressed("Space", "KeyE", "Enter", "KeyF")) {
			clearEmote(this.player);
		}
	}
}
