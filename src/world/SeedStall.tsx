import { InventorySlot } from "../inventory/InventorySlot";
import { GRID_SIZE } from "../inventory/inventoryStore";
import { PlayerPreview } from "../inventory/PlayerPreview";
import { SeedCard } from "./MarketCards";
import type { MarketItemControl } from "./MarketWindow";
import { SEED_STALL_ITEMS } from "./marketCatalog";
import type { MarketItemId } from "./marketData";

interface SeedStallProps {
	controls: Record<MarketItemId, MarketItemControl>;
	balance: number;
}

/**
 * The Seed Stall: a wooden split frame with the buyable seed cards on the left
 * and the player's inventory (paperdoll plus grid slots) on the right, so a
 * purchase is reflected in the bag immediately.
 */
export function SeedStall({ controls, balance }: SeedStallProps) {
	return (
		<div className="market-split">
			<section className="market-panel" aria-label="Seed shop">
				<h3 className="market-panel-title">SHOP - BUY</h3>
				<div className="market-seed-grid">
					{SEED_STALL_ITEMS.map((entry) => (
						<SeedCard
							key={entry.marketItemId}
							entry={entry}
							control={controls[entry.marketItemId]}
						/>
					))}
				</div>
			</section>

			<section className="market-panel" aria-label="Inventory">
				<h3 className="market-panel-title">INVENTORY</h3>
				<div className="market-inventory">
					<PlayerPreview />
					<div
						className="market-inventory-grid"
						data-testid="market-inventory-grid"
					>
						{Array.from({ length: GRID_SIZE }, (_, index) => (
							<InventorySlot
								// biome-ignore lint/suspicious/noArrayIndexKey: grid position is the stable key
								key={`market-grid-${index}`}
								area="grid"
								index={index}
							/>
						))}
					</div>
				</div>
				<p className="market-inventory-hint">
					Balance: {balance.toLocaleString()} GC
				</p>
			</section>
		</div>
	);
}
