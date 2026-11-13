import { useEffect, useState } from "react";
import { economy } from "../world/EconomyManager";
import {
	FARMER_FRAME_COUNT,
	FARMER_IDLE_FRAME,
	FARMER_SPRITE_URL,
} from "../world/farmerSprite";
import { getItemDef } from "./items";
import { useInventoryStore } from "./inventoryStore";
import { SlotIcon } from "./SlotIcon";

/**
 * 2D visual preview of the player model: the farmer's idle sprite frame, the
 * currently equipped hotbar item, and the Grangecoin wallet balance. Rendering
 * the real model here (rather than a color block) is the hook cosmetic changes
 * will hang off of.
 */
export function PlayerPreview() {
	const hotbar = useInventoryStore((s) => s.hotbar);
	const selectedHotbar = useInventoryStore((s) => s.selectedHotbar);
	const equipped = hotbar[selectedHotbar];
	const equippedDef = equipped.itemId ? getItemDef(equipped.itemId) : null;
	const [coins, setCoins] = useState(economy.getBalance());

	useEffect(() => economy.subscribe(setCoins), []);

	return (
		<section aria-label="Player preview" className="inv-preview">
			<h3 className="inv-preview-title">Farmer</h3>
			<div className="inv-paperdoll" aria-hidden="true">
				<div
					className="inv-player-model"
					data-testid="player-model"
					style={{
						backgroundImage: `url("${FARMER_SPRITE_URL}")`,
						// The sheet is one row of frames; zoom so a single frame fills
						// the element and pan to the idle frame.
						backgroundSize: `${FARMER_FRAME_COUNT * 100}% 100%`,
						backgroundPosition: `${
							FARMER_FRAME_COUNT > 1
								? (FARMER_IDLE_FRAME / (FARMER_FRAME_COUNT - 1)) * 100
								: 0
						}% 0`,
					}}
				/>
				{equippedDef && (
					<div className="inv-paperdoll-gear">
						<SlotIcon itemId={equipped.itemId} />
					</div>
				)}
			</div>
			<dl className="inv-preview-meta">
				<div>
					<dt>Equipped</dt>
					<dd data-testid="preview-equipped">
						{equippedDef ? equippedDef.name : "Hands"}
					</dd>
				</div>
				<div>
					<dt>Grangecoin balance</dt>
					<dd data-testid="preview-coins">{coins.toLocaleString()}</dd>
				</div>
			</dl>
			<p className="inv-preview-note">
				Grangecoin is kept in your wallet, not in inventory slots.
			</p>
		</section>
	);
}
