import * as ex from "excalibur";
import type { InputVector } from "./InputManager";

// The source image contains three 64×64 forward-facing walking frames.
export const FARMER_SPRITE_URL = "/assets/player_model/Farmer Forwards-Sheet.png";
/** Total frames laid out horizontally in the sheet. */
export const FARMER_FRAME_COUNT = 3;
/** Column holding the neutral, forward-facing pose (also used by the inventory preview). */
export const FARMER_IDLE_FRAME = 1;

export const farmerImage = new ex.ImageSource(FARMER_SPRITE_URL, {
	filtering: ex.ImageFiltering.Pixel,
});

export function addFarmerGraphics(player: ex.Actor): void {
	const sheet = ex.SpriteSheet.fromImageSource({
		image: farmerImage,
		grid: {
			rows: 1,
			columns: FARMER_FRAME_COUNT,
			spriteWidth: 64,
			spriteHeight: 64,
		},
	});
	player.graphics.add("idle", sheet.getSprite(FARMER_IDLE_FRAME, 0));
	player.graphics.add(
		"walk",
		ex.Animation.fromSpriteSheet(sheet, [0, 1, 2, 1], 140),
	);
	player.graphics.use("idle");
}

export function updateFarmerGraphics(
	player: ex.Actor,
	direction: InputVector,
): void {
	const graphic = direction.x === 0 && direction.y === 0 ? "idle" : "walk";
	if (player.graphics.current !== player.graphics.getGraphic(graphic)) {
		player.graphics.use(graphic);
	}
}
