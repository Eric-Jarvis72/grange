import { useState } from "react";
import { countItem, useInventoryStore } from "../inventory/inventoryStore";
import { emitSellTomatoes } from "../socket";
import { useGameStore } from "../store";
import { economy } from "./EconomyManager";
import type { MarketItemControl } from "./MarketWindow";
import { MARKET_ITEMS, type MarketId, type MarketItemId } from "./marketData";
import { useEconomyBalance } from "./useEconomy";

/**
 * Market overlay state and controls for a farm visit. Kept out of FarmMap so
 * that component stays within the repository's file-size budget.
 */
export function useFarmMarket(target: string | undefined, isOwner: boolean) {
	const farm = useGameStore((s) => s.activeFarm);
	const addItem = useInventoryStore((s) => s.addItem);
	const seedBags = useInventoryStore((s) => countItem(s, "seed-bag"));
	const balance = useEconomyBalance();
	const [market, setMarket] = useState<MarketId | null>(null);
	const [marketMessage, setMarketMessage] = useState<string | null>(null);

	function closeMarket() {
		setMarket(null);
		setMarketMessage(null);
	}

	function buyTomatoSeeds() {
		const item = MARKET_ITEMS["tomato-seed"];
		const result = economy.buy(item.price);
		if (!result.success) {
			setMarketMessage(result.error ?? "Purchase failed.");
			return;
		}
		addItem("seed-bag", item.quantity);
		setMarketMessage(
			`Bought ${item.quantity} tomato seeds for $${item.price}.`,
		);
	}

	function sellTomato(quantity: number) {
		if (!target || quantity < 1) return;
		const item = MARKET_ITEMS.tomato;
		emitSellTomatoes(target, quantity, (res) => {
			if (!res.ok) {
				setMarketMessage(res.error ?? "Sale failed.");
				return;
			}
			economy.sell(item.price * quantity);
			const noun = quantity === 1 ? "tomato" : "tomatoes";
			setMarketMessage(
				`Sold ${quantity} ${noun} for $${item.price * quantity}.`,
			);
		});
	}

	const itemControls: Record<MarketItemId, MarketItemControl> = {
		"tomato-seed": {
			owned: seedBags,
			disabled: balance < MARKET_ITEMS["tomato-seed"].price,
			actionLabel: "Buy",
			onAction: buyTomatoSeeds,
		},
		tomato: {
			owned: farm?.tomatoes ?? 0,
			disabled: !isOwner || (farm?.tomatoes ?? 0) < 1,
			actionLabel: "Sell",
			maxQuantity: farm?.tomatoes ?? 0,
			onAction: sellTomato,
		},
	};

	return {
		market,
		marketMessage,
		setMarket,
		setMarketMessage,
		closeMarket,
		itemControls,
	};
}
