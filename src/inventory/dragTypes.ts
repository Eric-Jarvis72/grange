import type { SlotRef } from "./inventoryStore";

/** Drag-and-drop payload types shared by the inventory and barn storage. */
export const SLOT_DRAG_TYPE = "application/x-grange-slot";
export const BARN_DRAG_TYPE = "application/x-grange-barn";

export interface BarnDragPayload {
	item: string;
	count: number;
}

export function serializeSlotRef(ref: SlotRef): string {
	return JSON.stringify(ref);
}

export function parseSlotRef(raw: string): SlotRef | null {
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

export function parseBarnPayload(raw: string): BarnDragPayload | null {
	try {
		const parsed = JSON.parse(raw) as BarnDragPayload;
		if (typeof parsed.item === "string" && parsed.item.length > 0) {
			return parsed;
		}
		return null;
	} catch {
		return null;
	}
}
