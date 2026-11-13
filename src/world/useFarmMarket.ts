import { useState } from "react";
import { countItem, useInventoryStore } from "../inventory/inventoryStore";
import type { ItemId } from "../inventory/items";
import { emitAddItem, emitRemoveItem, emitSellProduce } from "../socket";
import { useGameStore } from "../store";
import { economy } from "./EconomyManager";
import { type FishId, isFishId, isRodId, RODS } from "./fishingData";
import { useFishingStore } from "./fishingStore";
import type { MarketItemControl } from "./MarketWindow";
import { MARKET_ITEMS, type MarketId, type MarketItemId } from "./marketData";
import { seedPurchaseCap } from "./seedPurchase";
import { useEconomyBalance } from "./useEconomy";

/** Market seed id -> the inventory item it grants. */
const SEED_ITEMS: Record<string, ItemId> = {
	"tomato-seed": "seed-bag",
	"wheat-seed": "wheat-seed",
	"lettuce-seed": "lettuce-seed",
};

/** Hardware tools are one-off purchases; the rest restock the farm's supply. */
const HARDWARE_TOOLS: ItemId[] = ["hoe", "watering-can", "scythe", "shovel"];
const HARDWARE_STOCK: ItemId[] = ["fence", "gate", "sprinkler"];

/**
 * Market overlay state and controls for a farm visit. Seeds and produce follow
 * the crop registry and barn; fish sell straight out of the inventory and rods
 * upgrade the inventory's rod tools.
 */
export function useFarmMarket(target: string | undefined, isOwner: boolean) {
	const farm = useGameStore((s) => s.activeFarm);
	const addItem = useInventoryStore((s) => s.addItem);
	const removeItem = useInventoryStore((s) => s.removeItem);
	const grid = useInventoryStore((s) => s.grid);
	const hotbar = useInventoryStore((s) => s.hotbar);
	const equipRod = useFishingStore((s) => s.equipRod);
	const equippedRod = useFishingStore((s) => s.equippedRod);
	const balance = useEconomyBalance();
	const [market, setMarket] = useState<MarketId | null>(null);
	const [marketMessage, setMarketMessage] = useState<string | null>(null);

	const inventory = { grid, hotbar };
	const seedOwned: Record<string, number> = {
		"tomato-seed": countItem(inventory, "seed-bag"),
		"wheat-seed": countItem(inventory, "wheat-seed"),
		"lettuce-seed": countItem(inventory, "lettuce-seed"),
	};

	function closeMarket() {
		setMarket(null);
		setMarketMessage(null);
	}

	async function buySeed(id: MarketItemId, quantity: number) {
		const item = MARKET_ITEMS[id];
		const count = Math.floor(quantity);
		if (!SEED_ITEMS[id] || count < 1) return;
		try {
			const res = await fetch("/api/inventory/buy", {
				method: "POST",
				credentials: "same-origin",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ item: id, quantity: count }),
			});
			const data = (await res.json()) as {
				ok: boolean;
				error?: string;
				balance?: number;
				seeds?: Record<string, number>;
			};
			if (!res.ok || !data.ok) {
				setMarketMessage(data.error ?? "Purchase failed.");
				return;
			}
			if (typeof data.balance === "number") economy.setBalance(data.balance);
			if (data.seeds) useInventoryStore.getState().hydrateSeeds(data.seeds);
			setMarketMessage(
				`Bought ${count} ${item.name} for $${item.price * count}.`,
			);
		} catch {
			setMarketMessage("Could not reach the market.");
		}
	}

	async function buyTool(id: ItemId, quantity: number) {
		if (!isOwner || quantity < 1) return;
		const item = MARKET_ITEMS[id as MarketItemId];
		const result = economy.buy(item.price * quantity);
		if (!result.success) {
			setMarketMessage(result.error ?? "Purchase failed.");
			return;
		}
		addItem(id, quantity);
		setMarketMessage(`Bought the ${item.name}.`);
	}

	async function buyHardware(id: ItemId, quantity: number) {
		if (!isOwner || quantity < 1) return;
		const item = MARKET_ITEMS[id as MarketItemId];
		try {
			const res = await fetch("/api/hardware/buy", {
				method: "POST",
				credentials: "same-origin",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ item: id, quantity }),
			});
			const data = (await res.json()) as {
				ok: boolean;
				error?: string;
				balance?: number;
				count?: number;
			};
			if (!res.ok || !data.ok || data.balance === undefined) {
				setMarketMessage(data.error ?? "Purchase failed.");
				return;
			}
			economy.setBalance(data.balance);
			if (data.count !== undefined) {
				useInventoryStore.getState().setItemCount(id, data.count);
				const state = useGameStore.getState();
				if (state.activeFarm) {
					const field =
						id === "fence"
							? "fence_count"
							: id === "gate"
								? "gate_count"
								: "sprinkler_count";
					state.setActiveFarm({ ...state.activeFarm, [field]: data.count });
				}
			}
			setMarketMessage(
				`Bought ${quantity} ${item.name}${quantity > 1 ? "s" : ""} for $${item.price * quantity}.`,
			);
		} catch {
			setMarketMessage("Could not reach the hardware store.");
		}
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
			setMarketMessage(
				`Sold ${quantity} ${item.name} for $${item.price * quantity}.`,
			);
		});
	}

	function buyRod(id: MarketItemId) {
		if (!isRodId(id)) return;
		const item = MARKET_ITEMS[id];
		const result = economy.buy(item.price);
		if (!result.success) {
			setMarketMessage(result.error ?? "Purchase failed.");
			return;
		}
		addItem(id, 1);
		emitAddItem(id, 1);
		if (RODS[id].luck > RODS[equippedRod].luck) {
			equipRod(id);
			setMarketMessage(`Bought the ${item.name} — it's now equipped.`);
		} else {
			setMarketMessage(`Bought the ${item.name}. It's in your inventory.`);
		}
	}

	function sellCatch(id: FishId, quantity: number) {
		if (!isOwner || quantity < 1) return;
		const item = MARKET_ITEMS[id];
		const sold = removeItem(id, quantity);
		if (sold < 1) {
			setMarketMessage(`You have no ${item.name} to sell.`);
			return;
		}
		economy.sell(item.price * sold);
		emitRemoveItem(id, sold);
		setMarketMessage(`Sold ${sold} ${item.name} for $${item.price * sold}.`);
	}

	const itemControls = Object.fromEntries(
		Object.values(MARKET_ITEMS).map((item) => {
			if (isRodId(item.id)) {
				const owned = countItem(inventory, item.id);
				return [
					item.id,
					{
						owned,
						disabled: owned > 0 || balance < item.price,
						actionLabel: owned > 0 ? "Owned" : "Buy",
						onAction: () => buyRod(item.id),
					},
				];
			}
			if (isFishId(item.id)) {
				const fishId = item.id;
				const owned = countItem(inventory, fishId);
				return [
					fishId,
					{
						owned,
						disabled: !isOwner || owned < 1,
						actionLabel: "Sell",
						maxQuantity: owned,
						onAction: (quantity: number) => sellCatch(fishId, quantity),
					},
				];
			}
			if (item.kind === "buy") {
				if (HARDWARE_TOOLS.includes(item.id as ItemId)) {
					const itemId = item.id as ItemId;
					const owned = countItem(inventory, itemId);
					return [
						item.id,
						{
							owned,
							disabled: !isOwner || owned > 0 || balance < item.price,
							actionLabel: owned > 0 ? "Owned" : "Buy",
							onAction: (quantity: number) => void buyTool(itemId, quantity),
						},
					];
				}
				if (HARDWARE_STOCK.includes(item.id as ItemId)) {
					const itemId = item.id as ItemId;
					const owned =
						itemId === "fence"
							? (farm?.fence_count ?? 0)
							: itemId === "gate"
								? (farm?.gate_count ?? 0)
								: (farm?.sprinkler_count ?? 0);
					return [
						item.id,
						{
							owned,
							disabled: !isOwner || balance < item.price,
							actionLabel: "Buy",
							onAction: (quantity: number) => void buyHardware(itemId, quantity),
						},
					];
				}
				const seedId = SEED_ITEMS[item.id];
				return [
					item.id,
					{
						owned: seedOwned[item.id] ?? 0,
						disabled: balance < item.price,
						actionLabel: "Buy",
						maxQuantity: seedId
							? seedPurchaseCap(balance, item.price, seedId)
							: undefined,
						onAction: (quantity: number) => buySeed(item.id, quantity),
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
