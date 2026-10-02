import { useState } from "react";
import { getItemDef, type ItemId } from "./items";

export function SlotIcon({ itemId }: { itemId: ItemId | null }) {
	const [failed, setFailed] = useState(false);
	if (!itemId) return null;
	const def = getItemDef(itemId);
	if (def.icon.startsWith("/") && !failed) {
		return (
			<img
				src={def.icon}
				alt={def.name}
				draggable={false}
				className="inv-icon"
				onError={() => setFailed(true)}
			/>
		);
	}
	return (
		<span aria-hidden="true" className="inv-emoji">
			{def.icon.startsWith("/") ? "📦" : def.icon}
		</span>
	);
}
