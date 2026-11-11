import * as ex from "excalibur";
import {
	EMOTE_COLUMNS,
	EMOTE_FRAME_SIZE,
	EMOTES,
	type EmoteDef,
	type EmoteId,
	getEmote,
} from "../../shared/emotes";
import { startEmote } from "./farmerEmoteState";

/** Placeholder atlas; swap the PNG with hand art using the same 6x6 grid. */
export const FARMER_EMOTE_URL = "/assets/player_model/farmer-emotes.png";

export const farmerEmoteImage = new ex.ImageSource(FARMER_EMOTE_URL, {
	filtering: ex.ImageFiltering.Pixel,
});

let sharedSheet: ex.SpriteSheet | null = null;
const actorAnimations = new WeakMap<ex.Actor, Map<EmoteId, ex.Animation>>();

function spriteSheet(): ex.SpriteSheet {
	sharedSheet ??= ex.SpriteSheet.fromImageSource({
		image: farmerEmoteImage,
		grid: {
			rows: EMOTES.length,
			columns: EMOTE_COLUMNS,
			spriteWidth: EMOTE_FRAME_SIZE,
			spriteHeight: EMOTE_FRAME_SIZE,
		},
	});
	return sharedSheet;
}

export function emoteGraphicName(id: EmoteId): string {
	return `emote:${id}`;
}

function buildAnimation(emote: EmoteDef): ex.Animation {
	const indices = Array.from(
		{ length: emote.frames },
		(_, column) => emote.row * EMOTE_COLUMNS + column,
	);
	return ex.Animation.fromSpriteSheet(
		spriteSheet(),
		indices,
		emote.frameMs,
		ex.AnimationStrategy.Loop,
	);
}

function animationFor(actor: ex.Actor, emote: EmoteDef): ex.Animation {
	let animations = actorAnimations.get(actor);
	if (!animations) {
		animations = new Map();
		actorAnimations.set(actor, animations);
	}
	let animation = animations.get(emote.id);
	if (!animation) {
		animation = buildAnimation(emote);
		animations.set(emote.id, animation);
		actor.graphics.add(emoteGraphicName(emote.id), animation);
	}
	return animation;
}

/**
 * Starts a looping emote on an actor. The shared state machine in
 * `farmerEmoteState` tells `updateFarmerGraphics` to leave the graphic alone
 * until movement or an action clears it.
 */
export function playFarmerEmote(actor: ex.Actor, id: EmoteId): void {
	const emote = getEmote(id);
	if (!emote) return;
	const animation = animationFor(actor, emote);
	animation.reset();
	animation.play();
	actor.graphics.use(emoteGraphicName(emote.id));
	startEmote(actor, emote.id);
}
