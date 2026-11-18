import * as ex from "excalibur";

/**
 * Floating name tag used by hub avatars, farm presence, and the farmhand.
 * The actor is bottom-anchored at (0, 0); callers position it each frame.
 */
export function createNameLabel(text: string, color = "#fff4d6"): ex.Actor {
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
		new ex.Text({ text, font, color: ex.Color.fromHex(color) }),
	);
	return label;
}
