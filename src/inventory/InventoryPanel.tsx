import { GRID_SIZE, HOTBAR_SIZE, useInventoryStore } from "./inventoryStore";
import { InventorySlot } from "./InventorySlot";
import { PlayerPreview } from "./PlayerPreview";

export function InventoryPanel() {
	const open = useInventoryStore((s) => s.inventoryOpen);
	const setOpen = useInventoryStore((s) => s.setInventoryOpen);

	if (!open) return null;

	function onBackdropClick(e: React.MouseEvent) {
		if (e.target === e.currentTarget) setOpen(false);
	}

	return (
		// biome-ignore lint/a11y/useKeyWithClickEvents: backdrop click is a shortcut; keyboard path is Esc + Close button
		<div
			data-testid="inventory-panel"
			role="dialog"
			aria-modal="true"
			aria-label="Inventory"
			className="inv-backdrop"
			onClick={onBackdropClick}
		>
			<div className="inv-modal">
				<header className="inv-header">
					<h2>Inventory</h2>
					<button
						type="button"
						data-testid="inventory-close"
						className="inv-close"
						onClick={() => setOpen(false)}
					>
						Close [I]
					</button>
				</header>
				<div className="inv-body">
					<PlayerPreview />
					<div className="inv-grids">
						<section
							data-testid="inventory-grid"
							aria-label="Inventory slots"
							className="inv-grid"
						>
							{Array.from({ length: GRID_SIZE }, (_, i) => (
								<InventorySlot
									// biome-ignore lint/suspicious/noArrayIndexKey: grid position is the stable, meaningful key
									key={`grid-${i}`}
									area="grid"
									index={i}
								/>
							))}
						</section>
						<section aria-label="Hotbar slots" className="inv-hotbar-row">
							{Array.from({ length: HOTBAR_SIZE }, (_, i) => (
								<InventorySlot
									// biome-ignore lint/suspicious/noArrayIndexKey: hotbar position is the stable, meaningful key
									key={`panel-hotbar-${i}`}
									area="hotbar"
									index={i}
								/>
							))}
						</section>
						<p className="inv-hint">
							Drag to move · stacks merge · right-click a stack to split
							half
						</p>
					</div>
				</div>
			</div>
		</div>
	);
}
