import { BARN_DRAG_TYPE, parseSlotRef, SLOT_DRAG_TYPE } from "./dragTypes";
import type { SlotRef } from "./inventoryStore";
import { getItemDef, type ItemId } from "./items";
import { SlotIcon } from "./SlotIcon";

interface Props {
	index: number;
	itemId: ItemId | null;
	count: number;
	/** Clicking a stored stack takes the whole (or as much as fits) stack back. */
	onWithdraw: (itemId: ItemId) => void;
	/** Dropping a player inventory stack here stores it. */
	onDeposit: (from: SlotRef) => void;
}

/** One barn storage slot: click to take, or drop an inventory stack to store. */
export function StorageSlot({
	index,
	itemId,
	count,
	onWithdraw,
	onDeposit,
}: Props) {
	const def = itemId ? getItemDef(itemId) : null;

	function onDragStart(e: React.DragEvent) {
		if (!itemId) {
			e.preventDefault();
			return;
		}
		e.dataTransfer.setData(
			BARN_DRAG_TYPE,
			JSON.stringify({ item: itemId, count }),
		);
		e.dataTransfer.effectAllowed = "move";
	}

	function onDragOver(e: React.DragEvent) {
		e.preventDefault();
		e.dataTransfer.dropEffect = "move";
	}

	function onDrop(e: React.DragEvent) {
		e.preventDefault();
		const from = parseSlotRef(e.dataTransfer.getData(SLOT_DRAG_TYPE));
		if (from) onDeposit(from);
	}

	return (
		<button
			type="button"
			aria-label={
				def
					? `Take ${def.name}${count > 1 ? ` × ${count}` : ""}`
					: "Empty barn slot"
			}
			data-testid={`barn-slot-${index}`}
			data-item={itemId ?? ""}
			data-count={count}
			title={def ? `${def.name} — click to take` : "Empty storage slot"}
			className={`inv-slot${itemId ? " inv-slot-filled" : ""}`}
			draggable={Boolean(itemId)}
			onDragStart={onDragStart}
			onDragOver={onDragOver}
			onDrop={onDrop}
			onClick={() => itemId && onWithdraw(itemId)}
		>
			<SlotIcon itemId={itemId} />
			{def && count > 1 && <span className="inv-count">{count}</span>}
		</button>
	);
}
