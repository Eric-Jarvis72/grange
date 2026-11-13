import { NotificationFeed } from "../notifications/NotificationFeed";
import { usePauseStore } from "../pause/pauseStore";
import { BarnOverlay } from "../world/BarnOverlay";
import { EconomyHUD } from "../world/EconomyHUD";
import type { FarmHoveredTile } from "../world/farmHud";
import { Hotbar } from "./Hotbar";
import { useInventoryStore } from "./inventoryStore";

interface HudProps {
	tiles: number;
	hovered: FarmHoveredTile | null;
}

/**
 * In-game HUD. The top of the screen stays clear; the bottom holds the
 * hotbar (center), the chat/notification feed (left), and the Grangecoin
 * wallet plus keyboard prompts (right).
 */
export function Hud({ tiles, hovered }: HudProps) {
	const openInventory = useInventoryStore((s) => s.setInventoryOpen);
	const setPaused = usePauseStore((s) => s.setPaused);

	return (
		<div className="hud-root">
			<div className="hud-bottom-left">
				<NotificationFeed />
			</div>

			<div className="hud-bottom-center">
				<div className="hud-status">
					<span data-testid="farm-map-tiles">{tiles} tiles</span>
					<span data-testid="farm-tile">
						{hovered
							? `(${hovered.column}, ${hovered.row}): ${hovered.state}`
							: "—"}
					</span>
				</div>
				<Hotbar />
			</div>

			<div className="hud-bottom-right">
				<EconomyHUD />
				<button
					type="button"
					data-testid="open-inventory"
					className="hud-prompt"
					onClick={() => openInventory(true)}
				>
					[I] Inventory
				</button>
				<button
					type="button"
					data-testid="open-pause"
					className="hud-prompt"
					onClick={() => setPaused(true)}
				>
					[Esc] Pause
				</button>
			</div>

			<BarnOverlay />
		</div>
	);
}
