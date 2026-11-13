import type { LayoutSlot } from "./inventorySnapshot";
import { ITEMS, type ItemId } from "./items";

function empty(): LayoutSlot {
	return { itemId: null, count: 0 };
}

function firstFree(areas: LayoutSlot[][]): LayoutSlot | null {
	for (const list of areas) {
		for (const slot of list) {
			if (!slot.itemId) return slot;
		}
	}
	return null;
}

/**
 * Reconciles an authoritative item total with the current stack layout.
 *
 * Unlike a clear-and-place sync, this keeps existing stack positions when the
 * total is unchanged, so split fence, prop, and produce stacks survive a
 * refresh. Extra items fill partial stacks before opening a new slot.
 */
export function reconcileItemCount(
	grid: LayoutSlot[],
	hotbar: LayoutSlot[],
	itemId: ItemId,
	rawCount: number,
	keepZero = false,
): { grid: LayoutSlot[]; hotbar: LayoutSlot[] } {
	const nextGrid = grid.map((slot) => ({ ...slot }));
	const nextHotbar = hotbar.map((slot) => ({ ...slot }));
	const areas = [nextHotbar, nextGrid];
	const desired = Number.isFinite(rawCount)
		? Math.max(0, Math.floor(rawCount))
		: 0;
	const max = ITEMS[itemId].maxStack;
	const slots = areas.flat().filter((slot) => slot.itemId === itemId);
	const current = slots.reduce((total, slot) => total + slot.count, 0);

	if (desired === current) {
		if (desired === 0 && keepZero && slots.length === 0) {
			const free = firstFree(areas);
			if (free) {
				free.itemId = itemId;
				free.count = 0;
			}
		}
		return { grid: nextGrid, hotbar: nextHotbar };
	}

	if (desired === 0) {
		if (!keepZero) {
			for (const list of areas) {
				for (let index = 0; index < list.length; index += 1) {
					if (list[index].itemId === itemId) list[index] = empty();
				}
			}
			return { grid: nextGrid, hotbar: nextHotbar };
		}

		let kept = false;
		for (const list of areas) {
			for (let index = 0; index < list.length; index += 1) {
				if (list[index].itemId !== itemId) continue;
				list[index] = kept ? empty() : { itemId, count: 0 };
				kept = true;
			}
		}
		if (!kept) {
			const free = firstFree(areas);
			if (free) {
				free.itemId = itemId;
				free.count = 0;
			}
		}
		return { grid: nextGrid, hotbar: nextHotbar };
	}

	if (desired > current) {
		let add = desired - current;

		if (max > 1) {
			for (const list of areas) {
				for (const slot of list) {
					if (add <= 0) break;
					if (slot.itemId !== itemId || slot.count >= max) continue;
					const take = Math.min(max - slot.count, add);
					slot.count += take;
					add -= take;
				}
			}
		}

		for (const list of areas) {
			for (let index = 0; index < list.length && add > 0; index += 1) {
				if (list[index].itemId) continue;
				const take = Math.min(max, add);
				list[index] = { itemId, count: take };
				add -= take;
			}
		}
	} else {
		let remove = current - desired;
		for (const list of areas) {
			for (let index = 0; index < list.length && remove > 0; index += 1) {
				const slot = list[index];
				if (slot.itemId !== itemId) continue;
				const take = Math.min(slot.count, remove);
				const left = slot.count - take;
				list[index] = left > 0 ? { itemId, count: left } : empty();
				remove -= take;
			}
		}
	}

	return { grid: nextGrid, hotbar: nextHotbar };
}
