import * as ex from "excalibur";

const DURATION_MS = 720;
const RISE = 22;
const BURST_RADIUS = 46;
const BURST_INNER = 26;
const BURST_SPIKES = 14;
const INK = ex.Color.fromHex("#241208");
const BURST_FILL = ex.Color.fromHex("#f4b942");
const TEXT_FILL = ex.Color.fromHex("#fff4d6");

/**
 * Plays the comic "BONK!" burst once at a world point, then cleans itself up.
 *
 * The star and the hand-lettered shout pop in, drift upward, and fade out, so
 * the scene only has to call `play` and `update`.
 */
export class BonkFx {
	private burst: ex.Actor | null = null;
	private shout: ex.Actor | null = null;
	private elapsed = 0;
	private baseY = 0;

	constructor(private readonly scene: ex.Scene) {}

	/** Starts the comic burst centred on a world position. */
	play(x: number, y: number): void {
		this.clear();
		this.elapsed = 0;
		this.baseY = y;

		const burst = new ex.Actor({
			pos: ex.vec(x, y),
			anchor: ex.vec(0.5, 0.5),
			z: 500,
		});
		burst.graphics.use(
			new ex.Polygon({
				points: starPoints(),
				color: BURST_FILL,
				strokeColor: INK,
				lineWidth: 5,
			}),
		);
		this.scene.add(burst);
		this.burst = burst;

		const shout = new ex.Actor({
			pos: ex.vec(x, y),
			anchor: ex.vec(0.5, 0.5),
			z: 501,
		});
		shout.graphics.use(
			new ex.Text({
				text: "BONK!",
				font: new ex.Font({
					size: 38,
					family: '"Rye", serif',
					bold: true,
					textAlign: ex.TextAlign.Center,
					baseAlign: ex.BaseAlign.Middle,
					color: TEXT_FILL,
					strokeColor: INK,
					lineWidth: 7,
					shadow: {
						blur: 3,
						offset: ex.vec(2, 3),
						color: INK,
					},
				}),
			}),
		);
		this.scene.add(shout);
		this.shout = shout;
		this.apply(0);
	}

	update(deltaMs: number): void {
		if (!this.burst || !this.shout) return;
		this.elapsed += deltaMs;
		if (this.elapsed >= DURATION_MS) {
			this.clear();
			return;
		}
		this.apply(this.elapsed / DURATION_MS);
	}

	/** Drops the effect immediately, e.g. when the scene deactivates. */
	clear(): void {
		this.burst?.kill();
		this.shout?.kill();
		this.burst = null;
		this.shout = null;
	}

	private apply(t: number): void {
		const pop =
			t < 0.16
				? 0.45 + (t / 0.16) * 0.75
				: 1.2 - Math.min(0.2, (t - 0.16) * 0.7);
		const opacity = t > 0.62 ? 1 - (t - 0.62) / 0.38 : 1;
		const y = this.baseY - RISE * t;
		const rotation = -0.14 + t * 0.22;

		for (const actor of [this.burst, this.shout]) {
			if (!actor) continue;
			actor.scale = ex.vec(pop, pop);
			actor.pos.y = y;
			actor.rotation = rotation;
			actor.graphics.opacity = Math.max(0, opacity);
		}
	}
}

/** A chunky comic starburst with a positive bounding box for the raster. */
function starPoints(): ex.Vector[] {
	const points: ex.Vector[] = [];
	for (let i = 0; i < BURST_SPIKES * 2; i += 1) {
		const angle = (Math.PI * i) / BURST_SPIKES - Math.PI / 2;
		const radius = i % 2 === 0 ? BURST_RADIUS : BURST_INNER;
		points.push(
			ex.vec(
				BURST_RADIUS + Math.cos(angle) * radius,
				BURST_RADIUS + Math.sin(angle) * radius,
			),
		);
	}
	return points;
}
