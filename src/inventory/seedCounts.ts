import { ITEMS, type ItemId, SEED_CROPS } from "./items";

/** Minimal slot shape so this helper stays independent of the store module. */
export interface SeedSlot {
	itemId: ItemId | null;
	count: number;
}

function empty(): SeedSlot {
	return { itemId: null, count: 0 };
}

function seedLimit(itemId: ItemId, raw: number): number {
	const max = ITEMS[itemId].maxStack;
	if (!Number.isFinite(raw)) return 0;
	return Math.min(max, Math.max(0, Math.floor(raw)));
}

/**
 * Reconciles authoritative seed totals with the current hotbar and grid.
 *
 * Unlike the old seed-only hydration, this preserves multiple stacks of the
 * same seed: existing split positions stay put unless the total changed. Extra
 * seeds fill partial stacks first, then empty slots, matching `addItem`.
 */
export function applySeedCounts(
	grid: SeedSlot[],
	hotbar: SeedSlot[],
	seeds: Record<string, number>,
): { grid: SeedSlot[]; hotbar: SeedSlot[] } {
	const nextGrid = grid.map((slot) => ({ ...slot }));
	const nextHotbar = hotbar.map((slot) => ({ ...slot }));
	const areas = [nextHotbar, nextGrid];

	for (const itemId of Object.keys(SEED_CROPS) as ItemId[]) {
		const desired = seedLimit(itemId, Number(seeds[itemId] ?? 0));
		const current = areas
			.flat()
			.reduce(
				(total, slot) => (slot.itemId === itemId ? total + slot.count : total),
				0,
			);

		if (desired < current) {
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
			continue;
		}

		if (desired === current) continue;
		let add = desired - current;
		const max = ITEMS[itemId].maxStack;

		if (max > 1) {
			for (const list of areas) {
				for (let index = 0; index < list.length && add > 0; index += 1) {
					const slot = list[index];
					if (slot.itemId !== itemId || slot.count >= max) continue;
					const take = Math.min(max - slot.count, add);
					list[index] = { itemId, count: slot.count + take };
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
	}

	return { grid: nextGrid, hotbar: nextHotbar };
}
