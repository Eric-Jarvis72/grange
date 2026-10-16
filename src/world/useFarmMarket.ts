import { useState } from "react";
import { countItem, useInventoryStore } from "../inventory/inventoryStore";
import type { ItemId } from "../inventory/items";
import { emitSellProduce } from "../socket";
import { useGameStore } from "../store";
import { economy } from "./EconomyManager";
import type { MarketItemControl } from "./MarketWindow";
import { MARKET_ITEMS, type MarketId, type MarketItemId } from "./marketData";
import { useEconomyBalance } from "./useEconomy";

/** Market seed id -> the inventory item it grants. */
const SEED_ITEMS: Record<string, ItemId> = {
	"tomato-seed": "seed-bag",
	"wheat-seed": "wheat-seed",
	"lettuce-seed": "lettuce-seed",
};

/**
 * Market overlay state and controls for a farm visit. Each seed and produce
 * item gets its own buy/sell control, priced from the shared crop registry.
 */
export function useFarmMarket(target: string | undefined, isOwner: boolean) {
	const farm = useGameStore((s) => s.activeFarm);
	const addItem = useInventoryStore((s) => s.addItem);
	const tomatoSeeds = useInventoryStore((s) => countItem(s, "seed-bag"));
	const wheatSeeds = useInventoryStore((s) => countItem(s, "wheat-seed"));
	const lettuceSeeds = useInventoryStore((s) => countItem(s, "lettuce-seed"));
	const balance = useEconomyBalance();
	const [market, setMarket] = useState<MarketId | null>(null);
	const [marketMessage, setMarketMessage] = useState<string | null>(null);

	const seedOwned: Record<string, number> = {
		"tomato-seed": tomatoSeeds,
		"wheat-seed": wheatSeeds,
		"lettuce-seed": lettuceSeeds,
	};

	function closeMarket() {
		setMarket(null);
		setMarketMessage(null);
	}

	function buySeed(id: MarketItemId) {
		const item = MARKET_ITEMS[id];
		const itemId = SEED_ITEMS[id];
		if (!itemId) return;
		const result = economy.buy(item.price * item.quantity);
		if (!result.success) {
			setMarketMessage(result.error ?? "Purchase failed.");
			return;
		}
		addItem(itemId, item.quantity);
		setMarketMessage(
			`Bought ${item.quantity} ${item.name} for $${item.price * item.quantity}.`,
		);
	}

	function sellProduce(id: MarketItemId, quantity: number) {
		if (!target || quantity < 1) return;
		const item = MARKET_ITEMS[id];
		emitSellProduce(target, id, quantity, (res) => {
			if (!res.ok) {
				setMarketMessage(res.error ?? "Sale failed.");
				return;
			}
			economy.sell(item.price * quantity);
			setMarketMessage(`Sold ${quantity} ${item.name} for $${item.price * quantity}.`);
		});
	}

	const itemControls = Object.fromEntries(
		Object.values(MARKET_ITEMS).map((item) => {
			if (item.kind === "buy") {
				return [
					item.id,
					{
						owned: seedOwned[item.id] ?? 0,
						disabled: balance < item.price * item.quantity,
						actionLabel: "Buy",
						onAction: () => buySeed(item.id),
					},
				];
			}
			const owned = farm?.barn?.[item.id] ?? 0;
			return [
				item.id,
				{
					owned,
					disabled: !isOwner || owned < 1,
					actionLabel: "Sell",
					maxQuantity: owned,
					onAction: (quantity: number) => sellProduce(item.id, quantity),
				},
			];
		}),
	) as Record<MarketItemId, MarketItemControl>;

	return {
		market,
		marketMessage,
		setMarket,
		setMarketMessage,
		closeMarket,
		itemControls,
	};
}
