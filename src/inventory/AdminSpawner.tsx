import { useState } from "react";
import { CATALYST_IDS } from "../../shared/crops";
import { useGameStore } from "../store";
import { applyCatalystItems } from "./catalystUse";
import { useInventoryStore } from "./inventoryStore";
import { ITEMS, type ItemId } from "./items";

const CATALYST_SET = new Set<string>(CATALYST_IDS);

/** Sorted catalog entries for the admin spawner dropdown. */
const CATALOG = Object.values(ITEMS).sort((a, b) =>
	a.name.localeCompare(b.name),
);

/**
 * Admin-only creative item spawner. Catalysts are granted through the
 * server-backed admin endpoint so their ledger stays authoritative; every
 * other item is added to the local layout, which persists normally.
 */
export function AdminSpawner() {
	const user = useGameStore((s) => s.user);
	const [itemId, setItemId] = useState<ItemId>("sun-shard");
	const [count, setCount] = useState(1);
	const [busy, setBusy] = useState(false);
	const [notice, setNotice] = useState<string | null>(null);

	if (!user?.is_admin) return null;

	const def = ITEMS[itemId];

	async function spawn() {
		const quantity = Math.min(def.maxStack, Math.max(1, Math.floor(count)));
		setNotice(null);
		if (!CATALYST_SET.has(itemId)) {
			useInventoryStore.getState().addItem(itemId, quantity);
			setNotice(`Spawned ${quantity} ${def.name}.`);
			return;
		}

		setBusy(true);
		try {
			const res = await fetch("/api/admin/item", {
				method: "POST",
				credentials: "same-origin",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ item: itemId, count: quantity }),
			});
			const data = (await res.json()) as {
				ok: boolean;
				error?: string;
				count?: number;
				items?: Record<string, number>;
			};
			if (!res.ok || !data.ok) {
				setNotice(data.error ?? "Spawn failed.");
				return;
			}
			if (data.items) applyCatalystItems(data.items);
			setNotice(`Spawned ${data.count ?? quantity} ${def.name}.`);
		} catch {
			setNotice("Could not reach the server.");
		} finally {
			setBusy(false);
		}
	}

	return (
		<div className="inv-admin-spawner" data-testid="admin-spawner">
			<span className="inv-admin-spawner-title">Admin Spawner</span>
			<select
				data-testid="admin-spawn-select"
				value={itemId}
				onChange={(e) => {
					setItemId(e.target.value as ItemId);
					setCount(1);
				}}
			>
				{CATALOG.map((item) => (
					<option key={item.id} value={item.id}>
						{item.name}
					</option>
				))}
			</select>
			<input
				data-testid="admin-spawn-count"
				type="number"
				min={1}
				max={def.maxStack}
				value={count}
				onChange={(e) => setCount(Number(e.target.value) || 1)}
			/>
			<button
				type="button"
				data-testid="admin-spawn-button"
				disabled={busy}
				onClick={() => void spawn()}
			>
				{busy ? "Spawning..." : "Spawn"}
			</button>
			{notice && (
				<span
					className="inv-admin-spawner-notice"
					data-testid="admin-spawn-notice"
				>
					{notice}
				</span>
			)}
		</div>
	);
}
