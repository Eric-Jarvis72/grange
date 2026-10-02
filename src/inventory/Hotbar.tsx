import { HOTBAR_SIZE, useInventoryStore } from "./inventoryStore";
import { InventorySlot } from "./InventorySlot";

function keyHintFor(index: number): string {
	return index === 9 ? "0" : String(index + 1);
}

export function Hotbar() {
	const selected = useInventoryStore((s) => s.selectedHotbar);

	return (
		<div
			data-testid="hotbar"
			role="toolbar"
			aria-label="Toolbar. Press 1 through 0 to select."
			className="hud-hotbar"
		>
			{Array.from({ length: HOTBAR_SIZE }, (_, i) => (
				<InventorySlot
					// biome-ignore lint/suspicious/noArrayIndexKey: hotbar position is the stable, meaningful key
					key={`hotbar-${i}`}
					area="hotbar"
					index={i}
					selected={selected === i}
					keyHint={keyHintFor(i)}
				/>
			))}
		</div>
	);
}
