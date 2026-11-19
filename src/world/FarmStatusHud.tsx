import type { FarmHudSnapshot } from "./farmHud";

/** The farm's top-left status card (tomato count and the current hint). */
export function FarmStatusHud({ hud }: { hud: FarmHudSnapshot }) {
	return (
		<div className="farm-hud" data-testid="farm-hud">
			<div className="farm-status">
				<span data-testid="farm-tomatoes">🍅 {hud.tomatoes}</span>
			</div>
			<p className="farm-hint" data-testid="farm-hint">
				{hud.message}
			</p>
		</div>
	);
}
