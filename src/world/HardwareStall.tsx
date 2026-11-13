import { useState } from "react";
import { GenericCategoryGrid } from "./MarketCards";
import type { MarketItemControl } from "./MarketWindow";
import {
	MARKET_CATEGORIES,
	MARKETS,
	type MarketCategoryId,
	type MarketItemId,
} from "./marketData";

interface HardwareStallProps {
	controls: Record<MarketItemId, MarketItemControl>;
}

const HARDWARE_TABS = MARKETS.hardware.categories;

/**
 * The Hardware Stall: tools, building supplies, and automation gear, reusing the
 * generic category grid so the cards match the rest of the market.
 */
export function HardwareStall({ controls }: HardwareStallProps) {
	const [tab, setTab] = useState<MarketCategoryId>(
		MARKETS.hardware.defaultCategory,
	);

	return (
		<section className="market-produce" aria-label="Hardware stall">
			<div
				className="market-subtabs"
				role="tablist"
				aria-label="Hardware categories"
			>
				{HARDWARE_TABS.map((id) => {
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

			<GenericCategoryGrid categoryId={tab} controls={controls} />
		</section>
	);
}
