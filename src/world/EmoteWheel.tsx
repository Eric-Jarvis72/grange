import { EMOTES } from "../../shared/emotes";
import { useEmoteStore } from "../emotes/emoteStore";
import "./emoteWheel.css";

const RADIUS = 118;

/**
 * Radial emote picker. The active scene freezes while this is open; picking an
 * emote plays it locally and publishes it to the current hub or farm room.
 */
export function EmoteWheel() {
	const open = useEmoteStore((state) => state.open);
	const closeWheel = useEmoteStore((state) => state.closeWheel);
	const choose = useEmoteStore((state) => state.choose);

	if (!open) return null;

	return (
		<div
			className="emote-backdrop"
			data-testid="emote-wheel"
			onPointerDown={closeWheel}
		>
			<div
				className="emote-wheel"
				role="dialog"
				aria-modal="true"
				aria-label="Emote wheel"
				onPointerDown={(event) => event.stopPropagation()}
			>
				<p className="emote-wheel-title">Emotes</p>
				{EMOTES.map((emote, index) => {
					const angle = (index / EMOTES.length) * Math.PI * 2 - Math.PI / 2;
					const x = Math.cos(angle) * RADIUS;
					const y = Math.sin(angle) * RADIUS;
					return (
						<button
							key={emote.id}
							type="button"
							className="emote-slot"
							data-testid={`emote-${emote.id}`}
							style={{
								left: `calc(50% + ${x}px)`,
								top: `calc(50% + ${y}px)`,
							}}
							onClick={() => choose(emote.id)}
						>
							{emote.label}
						</button>
					);
				})}
				<p className="emote-wheel-hint">[T] or [Esc] close</p>
			</div>
		</div>
	);
}
