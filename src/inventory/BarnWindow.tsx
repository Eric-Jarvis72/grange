import { useEffect } from "react";
import { useGameStore } from "../store";
import { BARN_SLOTS, barnEntries, EMPTY_STORAGE } from "./barnStorage";
import type { BarnDragPayload } from "./dragTypes";
import { GRID_SIZE, HOTBAR_SIZE, useInventoryStore } from "./inventoryStore";
import { InventorySlot } from "./InventorySlot";
import type { ItemId } from "./items";
import { StorageSlot } from "./StorageSlot";
import { useBarnStorage } from "./useBarnStorage";

interface Props {
	owner: string;
	onClose: () => void;
}

/**
 * The barn storage container. Drag stacks between the two panels, press
 * Shift+E to store the selected hotbar stack, or click a storage slot to take
 * it back. The player inventory renders its own slots so the modal is
 * self-contained.
 */
export function BarnWindow({ owner, onClose }: Props) {
	const storage = useGameStore((s) => s.activeFarm?.storage ?? EMPTY_STORAGE);
	const selectedHotbar = useInventoryStore((s) => s.selectedHotbar);
	const { message, depositFrom, withdraw } = useBarnStorage(owner);
	const entries = barnEntries(storage);

	// Shift+E quick-moves the stack the player is holding into storage.
	useEffect(() => {
		function onKeyDown(e: KeyboardEvent) {
			if (e.repeat || e.metaKey || e.ctrlKey || e.altKey) return;
			if (!e.shiftKey || e.code !== "KeyE") return;
			e.preventDefault();
			depositFrom({ area: "hotbar", index: selectedHotbar });
		}
		window.addEventListener("keydown", onKeyDown);
		return () => window.removeEventListener("keydown", onKeyDown);
	}, [depositFrom, selectedHotbar]);

	function onBackdropClick(e: React.MouseEvent) {
		if (e.target === e.currentTarget) onClose();
	}

	function onReceiveBarn(payload: BarnDragPayload) {
		withdraw(payload.item as ItemId);
	}

	return (
		// biome-ignore lint/a11y/useKeyWithClickEvents: backdrop click is a shortcut; keyboard path is Esc + Close button
		<div
			data-testid="barn-window"
			role="dialog"
			aria-modal="true"
			aria-label="Barn storage"
			className="inv-backdrop"
			onClick={onBackdropClick}
		>
			<div className="inv-modal barn-modal">
				<header className="inv-header">
					<h2>Barn</h2>
					<button
						type="button"
						data-testid="barn-close"
						className="inv-close"
						onClick={onClose}
					>
						Close [Esc]
					</button>
				</header>
				<div className="barn-body">
					<section className="barn-section">
						<h3 className="barn-heading">Storage</h3>
						<section
							data-testid="barn-grid"
							aria-label="Barn storage slots"
							className="inv-grid"
						>
							{Array.from({ length: BARN_SLOTS }, (_, i) => (
								<StorageSlot
									// biome-ignore lint/suspicious/noArrayIndexKey: slot position is the stable, meaningful key
									key={`barn-${i}`}
									index={i}
									itemId={entries[i]?.itemId ?? null}
									count={entries[i]?.count ?? 0}
									onWithdraw={withdraw}
									onDeposit={depositFrom}
								/>
							))}
						</section>
					</section>
					<section className="barn-section">
						<h3 className="barn-heading">Your inventory</h3>
						<section
							data-testid="barn-player-grid"
							aria-label="Inventory slots"
							className="inv-grid"
						>
							{Array.from({ length: GRID_SIZE }, (_, i) => (
								<InventorySlot
									// biome-ignore lint/suspicious/noArrayIndexKey: grid position is the stable, meaningful key
									key={`barn-grid-${i}`}
									area="grid"
									index={i}
									onReceiveBarn={onReceiveBarn}
								/>
							))}
						</section>
						<section
							data-testid="barn-player-hotbar"
							aria-label="Hotbar slots"
							className="inv-hotbar-row"
						>
							{Array.from({ length: HOTBAR_SIZE }, (_, i) => (
								<InventorySlot
									// biome-ignore lint/suspicious/noArrayIndexKey: hotbar position is the stable, meaningful key
									key={`barn-hotbar-${i}`}
									area="hotbar"
									index={i}
									onReceiveBarn={onReceiveBarn}
								/>
							))}
						</section>
					</section>
				</div>
				<p className="inv-hint barn-hint">
					Drag stacks between panels · Shift+E stores the selected hotbar
					stack · click storage to take it back
				</p>
				{message && (
					<p className="barn-message" data-testid="barn-message">
						{message}
					</p>
				)}
			</div>
		</div>
	);
}
