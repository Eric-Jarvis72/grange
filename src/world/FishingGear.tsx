import { countItem, type InventorySlot } from "../inventory/inventoryStore";
import { FISH, FISH_ORDER, RODS, ROD_ORDER, type RodId } from "./fishingData";
import { comboLuckGain } from "./fishingGame";

interface FishingGearProps {
	/** Rods currently held in the inventory, in price order. */
	ownedRods: RodId[];
	equippedRod: RodId;
	onEquip: (id: RodId) => void;
	/** The player's inventory; the creel is just the fish stacks in it. */
	grid: InventorySlot[];
	hotbar: InventorySlot[];
}

/** The rods picker and creel list shown in the fishing overlay. */
export function FishingGear({
	ownedRods,
	equippedRod,
	onEquip,
	grid,
	hotbar,
}: FishingGearProps) {
	const inventory = { grid, hotbar };
	const held = FISH_ORDER.filter((id) => countItem(inventory, id) > 0);

	return (
		<>
			<details className="fish-rods" data-testid="fishing-rods">
				<summary>Rods</summary>
				<ul>
					{ROD_ORDER.filter((id) => ownedRods.includes(id)).map((id) => (
						<li key={id}>
							<button
								type="button"
								className={
									id === equippedRod ? "fish-rod fish-rod-active" : "fish-rod"
								}
								data-testid={`fishing-rod-${id}`}
								aria-pressed={id === equippedRod}
								onClick={() => onEquip(id)}
							>
								{RODS[id].name} · Luck {RODS[id].luck} · combo +
								{comboLuckGain(RODS[id].luck).toFixed(2)}
							</button>
						</li>
					))}
				</ul>
				<p className="fish-hint">
					Buy better rods at the produce market's Rods tab.
				</p>
			</details>

			<section className="fish-creel" data-testid="fishing-creel">
				<h3 className="fish-creel-title">Creel</h3>
				{held.length === 0 ? (
					<p className="fish-hint">Nothing yet — go catch something.</p>
				) : (
					<ul className="fish-creel-list">
						{held.map((id) => (
							<li key={id} data-testid={`fishing-held-${id}`}>
								<span>
									{FISH[id].emoji} {FISH[id].name}
								</span>
								<span>×{countItem(inventory, id)}</span>
							</li>
						))}
					</ul>
				)}
				<p className="fish-hint">
					Your catch is kept in your inventory. Sell it on the produce market's
					Fish tab.
				</p>
			</section>
		</>
	);
}
