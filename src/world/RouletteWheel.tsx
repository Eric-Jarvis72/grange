import { useEffect, useMemo, useRef, useState } from "react";
import { type PocketId, WHEEL_ORDER, pocketColor } from "./roulette";
import type { RoulettePhase } from "./rouletteTypes";
import { e2eMs } from "./testMode";
import { WHEEL_STEP, nextSpinAngles } from "./wheelAngles";

const SIZE = 300;
const CENTER = SIZE / 2;
const RADIUS = 142;
const LABEL_RADIUS = 104;

/** How long the wheel spins before the result is revealed, in ms. E2E shortens
 * the animation; the settled result is what a spec asserts. */
export const SPIN_MS = e2eMs(4_200, 1_000);

const FILL: Record<string, string> = {
	red: "#b3282d",
	black: "#1b1b1b",
	green: "#157347",
};

function polar(radius: number, deg: number): { x: number; y: number } {
	const rad = ((deg - 90) * Math.PI) / 180;
	return {
		x: CENTER + radius * Math.cos(rad),
		y: CENTER + radius * Math.sin(rad),
	};
}

function wedgePath(a1: number, a2: number): string {
	const p1 = polar(RADIUS, a1);
	const p2 = polar(RADIUS, a2);
	return `M ${CENTER} ${CENTER} L ${p1.x} ${p1.y} A ${RADIUS} ${RADIUS} 0 0 1 ${p2.x} ${p2.y} Z`;
}

interface RouletteWheelProps {
	phase: RoulettePhase;
	result: PocketId | null;
	onLanded: () => void;
}

export function RouletteWheel({ phase, result, onLanded }: RouletteWheelProps) {
	const [angle, setAngle] = useState({ wheel: 0, ball: 0 });
	const active = useRef(false);
	const landed = useRef(onLanded);
	landed.current = onLanded;

	const wedges = useMemo(
		() =>
			WHEEL_ORDER.map((pocket, index) => {
				const center = index * WHEEL_STEP;
				return {
					pocket,
					path: wedgePath(center - WHEEL_STEP / 2, center + WHEEL_STEP / 2),
					label: polar(LABEL_RADIUS, center),
					fill: FILL[pocketColor(pocket)],
				};
			}),
		[],
	);

	useEffect(() => {
		if (phase === "betting") {
			active.current = false;
			return;
		}
		if (phase !== "spinning" || result === null || active.current) return;
		active.current = true;
		setAngle((prev) => nextSpinAngles(prev, result));
		const timer = setTimeout(() => landed.current(), SPIN_MS);
		return () => clearTimeout(timer);
	}, [phase, result]);

	const ballIn = phase !== "betting";

	return (
		<div className="rl-wheel" data-testid="roulette-wheel">
			<svg
				viewBox={`0 0 ${SIZE} ${SIZE}`}
				role="img"
				aria-label="Roulette wheel"
			>
				<circle cx={CENTER} cy={CENTER} r={RADIUS + 6} fill="#4a2f1a" />
				<g
					className="rl-wheel-rotor"
					style={{ transform: `rotate(${angle.wheel}deg)` }}
				>
					{wedges.map((wedge) => (
						<path
							key={wedge.pocket}
							d={wedge.path}
							fill={wedge.fill}
							stroke="#e8dcc4"
							strokeWidth={0.6}
						/>
					))}
					{wedges.map((wedge) => (
						<text
							key={`label-${wedge.pocket}`}
							x={wedge.label.x}
							y={wedge.label.y}
							className="rl-wheel-number"
						>
							{wedge.pocket}
						</text>
					))}
					<circle
						cx={CENTER}
						cy={CENTER}
						r={40}
						fill="#4a2f1a"
						stroke="#e8dcc4"
						strokeWidth={2}
					/>
					<circle cx={CENTER} cy={CENTER} r={12} fill="#c9a227" />
				</g>
				<g
					className="rl-ball-arm"
					style={{ transform: `rotate(${angle.ball}deg)` }}
				>
					<g
						className={
							ballIn ? "rl-ball-radial rl-ball-radial-in" : "rl-ball-radial"
						}
					>
						<circle className="rl-ball" cx={CENTER} cy={CENTER} r={7} />
					</g>
				</g>
			</svg>
		</div>
	);
}
