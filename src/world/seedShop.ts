import { useInventoryStore } from "../inventory/inventoryStore";
import { economy } from "./EconomyManager";
import { MARKET_ITEMS, type MarketItemId } from "./marketData";

export interface SeedOrderResult {
	ok: boolean;
	error?: string;
	/** Display name of the seed, for the confirmation line. */
	name?: string;
	/** Grangecoin charged for the whole order. */
	total?: number;
}

/**
 * Buys seeds through the account-scoped inventory endpoint.
 *
 * The server owns the price, the balance, and the seed totals, so both the
 * market and the farmhand's bundles go through here rather than adjusting the
 * local inventory themselves. Seeds are hydrated from the reply, which keeps
 * the hotbar and grid stacks authoritative.
 */
export async function orderSeeds(
	id: MarketItemId,
	quantity: number,
): Promise<SeedOrderResult> {
	const count = Math.floor(quantity);
	const item = MARKET_ITEMS[id];
	if (count < 1) return { ok: false, error: "Choose at least one seed." };

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
			return { ok: false, error: data.error ?? "Purchase failed." };
		}
		if (typeof data.balance === "number") economy.setBalance(data.balance);
		if (data.seeds) useInventoryStore.getState().hydrateSeeds(data.seeds);
		return { ok: true, name: item.name, total: item.price * count };
	} catch {
		return { ok: false, error: "Could not reach the market." };
	}
}
