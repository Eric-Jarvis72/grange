import { ITEMS, type ItemId } from "./items";

export const HOTBAR_SIZE = 10;
export const GRID_SIZE = 24;
const ITEM_IDS = new Set(Object.keys(ITEMS));

export type SnapshotArea = "hotbar" | "grid";

export interface PersistedSlot {
	area: SnapshotArea;
	slot: number;
	item: ItemId;
	count: number;
}

export interface LayoutSlot {
	itemId: ItemId | null;
	count: number;
}

function empty(): LayoutSlot {
	return { itemId: null, count: 0 };
}

function areaSize(area: SnapshotArea): number {
	return area === "hotbar" ? HOTBAR_SIZE : GRID_SIZE;
}

function readSlot(raw: unknown): PersistedSlot | null {
	if (!raw || typeof raw !== "object") return null;
	const record = raw as Record<string, unknown>;
	const area = record.area;
	const slot = record.slot;
	const item = record.item;
	const count = record.count;

	if (area !== "hotbar" && area !== "grid") return null;
	if (!Number.isInteger(slot) || (slot as number) < 0) return null;
	if ((slot as number) >= areaSize(area)) return null;
	if (typeof item !== "string" || !ITEM_IDS.has(item)) return null;
	if (typeof count !== "number" || !Number.isFinite(count)) return null;

	const max = ITEMS[item as ItemId].maxStack;
	const safeCount = Math.min(max, Math.max(0, Math.floor(count)));
	if (safeCount <= 0) return null;

	return { area, slot: slot as number, item: item as ItemId, count: safeCount };
}

/**
 * Converts the server's persisted slots into concrete hotbar and grid arrays.
 * Invalid or duplicate rows are ignored; the last valid row for a position
 * wins. `occupied` lets callers fall back to the starter layout after an empty
 * or failed response.
 */
export function layoutFromSnapshot(slots: unknown): {
	grid: LayoutSlot[];
	hotbar: LayoutSlot[];
	occupied: number;
} {
	const grid = Array.from({ length: GRID_SIZE }, empty);
	const hotbar = Array.from({ length: HOTBAR_SIZE }, empty);
	if (!Array.isArray(slots)) return { grid, hotbar, occupied: 0 };

	let occupied = 0;
	for (const raw of slots) {
		const slot = readSlot(raw);
		if (!slot) continue;
		const list = slot.area === "hotbar" ? hotbar : grid;
		if (!list[slot.slot].itemId) occupied += 1;
		list[slot.slot] = { itemId: slot.item, count: slot.count };
	}

	return { grid, hotbar, occupied };
}

/** Serializes occupied slots for `PUT /api/inventory`. */
export function serializeInventory(
	grid: LayoutSlot[],
	hotbar: LayoutSlot[],
): PersistedSlot[] {
	const slots: PersistedSlot[] = [];

	for (const [area, list] of [
		["hotbar", hotbar],
		["grid", grid],
	] as const) {
		for (let slot = 0; slot < list.length; slot += 1) {
			const entry = list[slot];
			if (!entry.itemId || entry.count <= 0) continue;
			slots.push({
				area,
				slot,
				item: entry.itemId,
				count: entry.count,
			});
		}
	}

	return slots;
}
