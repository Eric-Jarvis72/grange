import { getItemDef } from "./items";
import { countItem, useInventoryStore } from "./inventoryStore";
import { SlotIcon } from "./SlotIcon";

/**
 * 2D stand-in for the wireframe's "3D preview". Shows a pixel-style
 * paper-doll (player color block from FarmMapScene) plus the currently
 * equipped hotbar item and a derived Grangecoin total. Grangecoin remains
 * physical — the total here is display-only aggregation, not a wallet.
 */
export function PlayerPreview() {
	const hotbar = useInventoryStore((s) => s.hotbar);
	const selectedHotbar = useInventoryStore((s) => s.selectedHotbar);
	const grid = useInventoryStore((s) => s.grid);
	const equipped = hotbar[selectedHotbar];
	const equippedDef = equipped.itemId ? getItemDef(equipped.itemId) : null;
	const coins = countItem({ grid, hotbar }, "grangecoin");

	return (
		<section aria-label="Player preview" className="inv-preview">
			<h3 className="inv-preview-title">Farmer</h3>
			<div className="inv-paperdoll" aria-hidden="true">
				<div className="inv-paperdoll-body" />
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
					<dt>Grangecoin (in slots)</dt>
					<dd data-testid="preview-coins">{coins}</dd>
				</div>
			</dl>
			<p className="inv-preview-note">
				Coin has no wallet counter — it lives in slots like any stack.
			</p>
		</section>
	);
}
