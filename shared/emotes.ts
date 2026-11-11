export type EmoteId = "wave" | "cheer" | "dance" | "sit" | "sleep" | "shrug";

export interface EmoteDef {
	id: EmoteId;
	label: string;
	/** Zero-based row in the farmer emote atlas. */
	row: number;
	/** Frames to loop from the start of the row. */
	frames: number;
	/** Milliseconds each frame stays on screen. */
	frameMs: number;
}

/**
 * Single source of truth for the emote wheel and the client animation.
 *
 * The atlas is a uniform 6x6 grid of 64x64 frames, one emote per row, so
 * `row`/`frames` describe exactly which cells belong to an emote. The Phoenix
 * channels keep a matching id whitelist (`@emotes`).
 */
export const EMOTES: readonly EmoteDef[] = [
	{ id: "wave", label: "Wave", row: 0, frames: 4, frameMs: 160 },
	{ id: "cheer", label: "Cheer", row: 1, frames: 4, frameMs: 160 },
	{ id: "dance", label: "Dance", row: 2, frames: 6, frameMs: 140 },
	{ id: "sit", label: "Sit", row: 3, frames: 4, frameMs: 240 },
	{ id: "sleep", label: "Sleep", row: 4, frames: 4, frameMs: 300 },
	{ id: "shrug", label: "Shrug", row: 5, frames: 4, frameMs: 160 },
];

/** Widest emote row; the atlas is laid out with this many columns. */
export const EMOTE_COLUMNS = 6;

export const EMOTE_FRAME_SIZE = 64;

export const EMOTE_IDS: readonly EmoteId[] = EMOTES.map((emote) => emote.id);

export function getEmote(id: string): EmoteDef | undefined {
	return EMOTES.find((emote) => emote.id === id);
}
