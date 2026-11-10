import { useEffect, useRef, useState } from "react";
import {
	REEL_COUNT,
	SLOT_SYMBOLS,
	type SlotSymbol,
	symbolDef,
} from "./slots";
import type { SlotsPhase } from "./slotsTypes";
import { e2eMs } from "./testMode";

/** How long the reels spin before the result is revealed, in ms. E2E shortens
 * the animation; the settled faces are what a spec asserts. */
export const SPIN_MS = e2eMs(1_800, 500);
/** How fast the faces flash while spinning, in ms. */
const TICK_MS = e2eMs(70, 40);

/** Faces shown before the first spin. */
const IDLE_FACES: SlotSymbol[] = ["cherry", "bell", "diamond"];

interface SlotsReelsProps {
	phase: SlotsPhase;
	/** The settled faces, empty until the first spin. */
	reels: SlotSymbol[];
	winningSymbol: SlotSymbol | null;
	onLanded: () => void;
}

function randomFace(): SlotSymbol {
	return SLOT_SYMBOLS[Math.floor(Math.random() * SLOT_SYMBOLS.length)].id;
}

function randomStrip(): SlotSymbol[] {
	return Array.from({ length: REEL_COUNT }, randomFace);
}

/**
 * The three animated reels. While the machine is spinning it flashes random
 * faces, then reveals the result and calls `onLanded` so the table can settle.
 */
export function SlotsReels({
	phase,
	reels,
	winningSymbol,
	onLanded,
}: SlotsReelsProps) {
	const spinning = phase === "spinning";
	const [faces, setFaces] = useState<SlotSymbol[]>(IDLE_FACES);
	const landed = useRef(onLanded);
	landed.current = onLanded;

	useEffect(() => {
		if (spinning) {
			const tick = setInterval(() => setFaces(randomStrip()), TICK_MS);
			const stop = setTimeout(() => {
				clearInterval(tick);
				landed.current();
			}, SPIN_MS);
			return () => {
				clearInterval(tick);
				clearTimeout(stop);
			};
		}
		setFaces(reels.length === REEL_COUNT ? reels : IDLE_FACES);
	}, [spinning, reels]);

	return (
		<div
			className={spinning ? "sl-reels sl-reels-spinning" : "sl-reels"}
			data-testid="slots-reels"
		>
			{faces.map((id, index) => {
				const def = symbolDef(id);
				const isWin = !spinning && winningSymbol === id;
				return (
					<div
						// The strip is always three reels; position is the identity.
						// biome-ignore lint/suspicious/noArrayIndexKey: fixed three reels
						key={index}
						className={isWin ? "sl-reel sl-reel-win" : "sl-reel"}
						data-testid={`slots-reel-${index}`}
						data-symbol={id}
					>
						<span className="sl-reel-glyph" aria-hidden="true">
							{def.glyph}
						</span>
						<span className="sl-reel-name">{def.label}</span>
					</div>
				);
			})}
		</div>
	);
}
