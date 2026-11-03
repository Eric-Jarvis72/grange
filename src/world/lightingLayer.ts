import {
	DAY_NIGHT_CYCLE_MS,
	cycleTimeNow,
	type WorldTime,
} from "../../shared/mechanics";
import type { LightSource } from "./lightSources";

const MINUTE = 60_000;

interface Keyframe {
	t: number;
	color: [number, number, number];
	opacity: number;
}

/** Dawn -> day -> dusk -> night, keyed by cycle milliseconds. */
const KEYFRAMES: Keyframe[] = [
	{ t: 0, color: [244, 168, 96], opacity: 0.16 },
	{ t: 2 * MINUTE, color: [255, 255, 255], opacity: 0 },
	{ t: 22 * MINUTE, color: [255, 255, 255], opacity: 0 },
	{ t: 24 * MINUTE, color: [201, 106, 74], opacity: 0.22 },
	{ t: 26 * MINUTE, color: [27, 36, 80], opacity: 0.4 },
	{ t: 34 * MINUTE, color: [27, 36, 80], opacity: 0.4 },
	{ t: 36 * MINUTE, color: [244, 168, 96], opacity: 0.16 },
];

interface Blend {
	color: [number, number, number];
	opacity: number;
}

function lerp(a: number, b: number, p: number): number {
	return a + (b - a) * p;
}

function blendFor(cycleTimeMs: number): Blend {
	const t = ((cycleTimeMs % DAY_NIGHT_CYCLE_MS) + DAY_NIGHT_CYCLE_MS) %
		DAY_NIGHT_CYCLE_MS;
	for (let i = 0; i < KEYFRAMES.length - 1; i += 1) {
		const a = KEYFRAMES[i];
		const b = KEYFRAMES[i + 1];
		if (t < a.t || t > b.t) continue;
		const span = b.t - a.t || 1;
		const p = Math.min(1, Math.max(0, (t - a.t) / span));
		return {
			color: [
				lerp(a.color[0], b.color[0], p),
				lerp(a.color[1], b.color[1], p),
				lerp(a.color[2], b.color[2], p),
			],
			opacity: lerp(a.opacity, b.opacity, p),
		};
	}
	return { color: KEYFRAMES[KEYFRAMES.length - 1].color, opacity: 0 };
}

export interface CameraView {
	x: number;
	y: number;
	zoom: number;
}

export interface LightingLayerOptions {
	resolution: { width: number; height: number };
	getGameCanvas: () => HTMLCanvasElement | null;
	getTime: () => WorldTime | null;
	getCamera: () => CameraView | null;
	getLightSources: () => LightSource[];
}

/**
 * Renders a screen-space night overlay: a multiply dark tint that slowly
 * blends through dawn, day, dusk, and night, with radial gradients erasing
 * holes for lanterns, windows, and glowing crops.
 */
export class LightingLayer {
	private readonly ctx: CanvasRenderingContext2D | null;
	private frame = 0;
	private running = false;

	constructor(
		private readonly canvas: HTMLCanvasElement,
		private readonly options: LightingLayerOptions,
	) {
		this.ctx = canvas.getContext("2d");
	}

	start(): void {
		if (this.running) return;
		this.running = true;
		const loop = () => {
			if (!this.running) return;
			this.draw();
			this.frame = requestAnimationFrame(loop);
		};
		this.frame = requestAnimationFrame(loop);
	}

	stop(): void {
		this.running = false;
		if (this.frame) cancelAnimationFrame(this.frame);
		this.frame = 0;
	}

	draw(): void {
		const ctx = this.ctx;
		if (!ctx) return;
		this.resize();
		const { width, height } = this.canvas;
		ctx.clearRect(0, 0, width, height);

		const time = this.options.getTime();
		if (!time) return;
		const blend = blendFor(cycleTimeNow(time));
		if (blend.opacity <= 0.004) return;

		const [r, g, b] = blend.color;
		ctx.globalCompositeOperation = "multiply";
		ctx.globalAlpha = blend.opacity;
		ctx.fillStyle = `rgb(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)})`;
		ctx.fillRect(0, 0, width, height);
		ctx.globalAlpha = 1;

		const camera = this.options.getCamera();
		if (!camera) {
			ctx.globalCompositeOperation = "source-over";
			return;
		}

		const sx = width / this.options.resolution.width;
		const sy = height / this.options.resolution.height;
		const scale = Math.min(sx, sy);
		const zoom = camera.zoom || 1;

		for (const light of this.options.getLightSources()) {
			const px = (light.x - camera.x) * zoom * sx;
			const py = (light.y - camera.y) * zoom * sy;
			const radius = light.radius * zoom * scale;
			if (
				px + radius < 0 ||
				py + radius < 0 ||
				px - radius > width ||
				py - radius > height
			) {
				continue;
			}
			this.punch(ctx, px, py, radius);
			this.glow(ctx, px, py, radius);
		}

		ctx.globalCompositeOperation = "source-over";
	}

	private punch(
		ctx: CanvasRenderingContext2D,
		x: number,
		y: number,
		radius: number,
	): void {
		const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
		gradient.addColorStop(0, "rgba(0, 0, 0, 1)");
		gradient.addColorStop(0.55, "rgba(0, 0, 0, 0.78)");
		gradient.addColorStop(1, "rgba(0, 0, 0, 0)");
		ctx.globalCompositeOperation = "destination-out";
		ctx.fillStyle = gradient;
		ctx.beginPath();
		ctx.arc(x, y, radius, 0, Math.PI * 2);
		ctx.fill();
	}

	private glow(
		ctx: CanvasRenderingContext2D,
		x: number,
		y: number,
		radius: number,
	): void {
		const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
		gradient.addColorStop(0, "rgba(255, 208, 132, 0.32)");
		gradient.addColorStop(0.7, "rgba(255, 208, 132, 0.08)");
		gradient.addColorStop(1, "rgba(255, 208, 132, 0)");
		ctx.globalCompositeOperation = "screen";
		ctx.fillStyle = gradient;
		ctx.beginPath();
		ctx.arc(x, y, radius, 0, Math.PI * 2);
		ctx.fill();
	}

	private resize(): void {
		const game = this.options.getGameCanvas();
		if (!game) return;
		if (this.canvas.width !== game.width) this.canvas.width = game.width;
		if (this.canvas.height !== game.height) this.canvas.height = game.height;

		// Match Excalibur's letterboxed canvas rect, not the whole page.
		const rect = game.getBoundingClientRect();
		if (rect.width > 0 && rect.height > 0) {
			this.canvas.style.right = "auto";
			this.canvas.style.bottom = "auto";
			this.canvas.style.left = `${rect.left}px`;
			this.canvas.style.top = `${rect.top}px`;
			this.canvas.style.width = `${rect.width}px`;
			this.canvas.style.height = `${rect.height}px`;
		}
	}
}
