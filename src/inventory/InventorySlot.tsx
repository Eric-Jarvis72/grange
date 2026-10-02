import { getItemDef } from "./items";
import {
	useInventoryStore,
	type SlotArea,
	type SlotRef,
} from "./inventoryStore";
import { SlotIcon } from "./SlotIcon";

interface Props {
	area: SlotArea;
	index: number;
	selected?: boolean;
	keyHint?: string;
}

function dragPayload(ref: SlotRef): string {
	return JSON.stringify(ref);
}

function parsePayload(raw: string): SlotRef | null {
	try {
		const parsed = JSON.parse(raw) as SlotRef;
		if (
			(parsed.area === "grid" || parsed.area === "hotbar") &&
			Number.isInteger(parsed.index)
		) {
			return parsed;
		}
		return null;
	} catch {
		return null;
	}
}

export function InventorySlot({ area, index, selected, keyHint }: Props) {
	const slot = useInventoryStore((s) =>
		area === "grid" ? s.grid[index] : s.hotbar[index],
	);
	const moveStack = useInventoryStore((s) => s.moveStack);
	const splitHalf = useInventoryStore((s) => s.splitHalf);
	const selectHotbar = useInventoryStore((s) => s.selectHotbar);

	const ref: SlotRef = { area, index };
	const def = slot.itemId ? getItemDef(slot.itemId) : null;

	function onDragStart(e: React.DragEvent) {
		if (!slot.itemId) {
			e.preventDefault();
			return;
		}
		e.dataTransfer.setData("application/x-grange-slot", dragPayload(ref));
		e.dataTransfer.effectAllowed = "move";
	}

	function onDragOver(e: React.DragEvent) {
		e.preventDefault();
		e.dataTransfer.dropEffect = "move";
	}

	function onDrop(e: React.DragEvent) {
		e.preventDefault();
		const raw = e.dataTransfer.getData("application/x-grange-slot");
		const from = parsePayload(raw);
		if (from) moveStack(from, ref);
	}

	function onClick() {
		if (area === "hotbar") selectHotbar(index);
	}

	function onContextMenu(e: React.MouseEvent) {
		// Right-click a stackable slot to split half into the first empty
		// slot (grid first, then hotbar). Simple and keyboard-testable.
		e.preventDefault();
		if (!slot.itemId || slot.count <= 1) return;
		const { grid, hotbar } = useInventoryStore.getState();
		const emptyGrid = grid.findIndex((s) => !s.itemId);
		if (emptyGrid >= 0 && !(area === "grid" && emptyGrid === index)) {
			splitHalf(ref, { area: "grid", index: emptyGrid });
			return;
		}
		const emptyHotbar = hotbar.findIndex((s) => !s.itemId);
		if (emptyHotbar >= 0 && !(area === "hotbar" && emptyHotbar === index)) {
			splitHalf(ref, { area: "hotbar", index: emptyHotbar });
		}
	}

	return (
		<button
			type="button"
			aria-label={
				def ? `${def.name}${slot.count > 1 ? ` × ${slot.count}` : ""}` : "Empty slot"
			}
			data-testid={`slot-${area}-${index}`}
			data-item={slot.itemId ?? ""}
			data-count={slot.count}
			title={def ? `${def.name} — ${def.description}` : "Empty slot"}
			className={`inv-slot${selected ? " inv-slot-selected" : ""}${slot.itemId ? " inv-slot-filled" : ""}`}
			draggable={Boolean(slot.itemId)}
			onDragStart={onDragStart}
			onDragOver={onDragOver}
			onDrop={onDrop}
			onClick={onClick}
			onContextMenu={onContextMenu}
		>
			{keyHint && <span className="inv-key">{keyHint}</span>}
			<SlotIcon itemId={slot.itemId} />
			{def && def.maxStack > 1 && slot.count > 1 && (
				<span className="inv-count">{slot.count}</span>
			)}
		</button>
	);
}
