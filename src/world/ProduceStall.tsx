import { useState } from "react";
import { GenericCategoryGrid, ProduceCard } from "./MarketCards";
import type { MarketItemControl } from "./MarketWindow";
import { PRODUCE_SECONDARY_TABS, PRODUCE_STALL_ITEMS } from "./marketCatalog";
import {
	MARKET_CATEGORIES,
	type MarketCategoryId,
	type MarketItemId,
} from "./marketData";

interface ProduceStallProps {
	controls: Record<MarketItemId, MarketItemControl>;
}

const PRODUCE_TABS: MarketCategoryId[] = ["sell", ...PRODUCE_SECONDARY_TABS];

/**
 * The Produce Stall: a 3x2 grid of barn crops to sell, with the simpler
 * fish/rods/tools/train tabs kept alongside until each gets its own shop.
 */
export function ProduceStall({ controls }: ProduceStallProps) {
	const [tab, setTab] = useState<MarketCategoryId>("sell");

	return (
		<section className="market-produce" aria-label="Produce stall">
			<div
				className="market-subtabs"
				role="tablist"
				aria-label="Produce categories"
			>
				{PRODUCE_TABS.map((id) => {
					const selected = id === tab;
					return (
						<button
							key={id}
							type="button"
							role="tab"
							aria-selected={selected}
							className={`market-subtab${selected ? " market-subtab-active" : ""}`}
							data-testid={`market-subtab-${id}`}
							onClick={() => setTab(id)}
						>
							{MARKET_CATEGORIES[id].label}
						</button>
					);
				})}
			</div>

			{tab === "sell" ? (
				<>
					<p className="market-subheader">Sell your harvested crops here!</p>
					<div className="market-produce-grid">
						{PRODUCE_STALL_ITEMS.map((entry) => (
							<ProduceCard
								key={entry.marketItemId}
								entry={entry}
								control={controls[entry.marketItemId]}
							/>
						))}
					</div>
				</>
			) : (
				<GenericCategoryGrid categoryId={tab} controls={controls} />
			)}
		</section>
	);
}
