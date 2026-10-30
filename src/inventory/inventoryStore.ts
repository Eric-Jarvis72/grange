import { create } from "zustand";
import { usePauseStore } from "../pause/pauseStore";
import { STARTER_ROD } from "../world/fishingData";
import { buildAdminInventory } from "./adminInventory";
import {
	GRID_SIZE,
	HOTBAR_SIZE,
	layoutFromSnapshot,
} from "./inventorySnapshot";
import { reconcileItemCount } from "./itemCounts";
import { ITEMS, type ItemId } from "./items";
import { applySeedCounts } from "./seedCounts";

export { GRID_SIZE, HOTBAR_SIZE };

export type SlotArea = "grid" | "hotbar";

export interface InventorySlot {
	itemId: ItemId | null;
	count: number;
}

export interface SlotRef {
	area: SlotArea;
	index: number;
}

function emptySlot(): InventorySlot {
	return { itemId: null, count: 0 };
}

function stack(itemId: ItemId, count: number): InventorySlot {
	return { itemId, count };
}

function buildInitialGrid(): InventorySlot[] {
	return Array.from({ length: GRID_SIZE }, emptySlot);
}

function buildInitialHotbar(): InventorySlot[] {
	const hotbar = Array.from({ length: HOTBAR_SIZE }, emptySlot);
	hotbar[0] = stack("hoe", 1);
	hotbar[1] = stack("seed-bag", 10);
	hotbar[2] = stack("watering-can", 1);
	hotbar[3] = stack("scythe", 1);
	hotbar[4] = stack("gate", 2);
	hotbar[5] = stack("fence", 20);
	hotbar[6] = stack("shovel", 1);
	hotbar[7] = stack(STARTER_ROD, 1);
	return hotbar;
}

interface InventoryState {
	grid: InventorySlot[];
	hotbar: InventorySlot[];
	selectedHotbar: number;
	inventoryOpen: boolean;
	/** True once the account's full inventory snapshot has been applied (or failed). */
	inventoryHydrated: boolean;
	/** True only when the last snapshot came from the server. */
	inventorySynced: boolean;
	selectHotbar: (index: number) => void;
	setInventoryOpen: (open: boolean) => void;
	toggleInventory: () => void;
	moveStack: (from: SlotRef, to: SlotRef) => void;
	splitHalf: (from: SlotRef, to: SlotRef) => void;
	addItem: (itemId: ItemId, count: number) => number;
	/** Removes up to `count` of an item across slots. Returns how many were removed. */
	removeItem: (itemId: ItemId, count: number) => number;
	removeAt: (ref: SlotRef, count: number) => void;
	grantAllItems: () => void;
	setItemCount: (itemId: ItemId, count: number) => void;
	hydrateInventory: (slots: unknown, seeds: Record<string, number>) => void;
	hydrateSeeds: (seeds: Record<string, number>) => void;
	markInventoryHydrated: () => void;
	resetInventory: () => void;
}

function slotsOf(state: InventoryState, area: SlotArea): InventorySlot[] {
	return area === "grid" ? state.grid : state.hotbar;
}

export const useInventoryStore = create<InventoryState>((set, get) => ({
	grid: buildInitialGrid(),
	hotbar: buildInitialHotbar(),
	selectedHotbar: 0,
	inventoryOpen: false,
	inventoryHydrated: false,
	inventorySynced: false,

	selectHotbar: (index) => {
		if (index < 0 || index >= HOTBAR_SIZE) return;
		set({ selectedHotbar: index });
	},

	setInventoryOpen: (open) => set({ inventoryOpen: open }),
	toggleInventory: () => set((s) => ({ inventoryOpen: !s.inventoryOpen })),

	moveStack: (from, to) => {
		if (from.area === to.area && from.index === to.index) return;
		const state = get();
		const sourceList = slotsOf(state, from.area);
		const destList = slotsOf(state, to.area);
		if (!sourceList[from.index] || !destList[to.index]) return;
		const source = sourceList[from.index];
		if (!source.itemId || source.count <= 0) return;

		const nextGrid = [...state.grid];
		const nextHotbar = [...state.hotbar];
		const getList = (area: SlotArea) =>
			area === "grid" ? nextGrid : nextHotbar;
		const nextSource = { ...getList(from.area)[from.index] };
		const nextDest = { ...getList(to.area)[to.index] };

		if (!nextDest.itemId) {
			getList(to.area)[to.index] = nextSource;
			getList(from.area)[from.index] = emptySlot();
		} else if (
			nextDest.itemId === nextSource.itemId &&
			ITEMS[nextSource.itemId].maxStack > 1
		) {
			const max = ITEMS[nextSource.itemId].maxStack;
			const total = nextDest.count + nextSource.count;
			const merged = Math.min(max, total);
			const remainder = total - merged;
			getList(to.area)[to.index] = { itemId: nextDest.itemId, count: merged };
			getList(from.area)[from.index] =
				remainder > 0
					? { itemId: nextSource.itemId, count: remainder }
					: emptySlot();
		} else {
			getList(to.area)[to.index] = nextSource;
			getList(from.area)[from.index] = nextDest;
		}

		set({ grid: nextGrid, hotbar: nextHotbar });
	},

	splitHalf: (from, to) => {
		const state = get();
		const sourceList = slotsOf(state, from.area);
		const destList = slotsOf(state, to.area);
		const source = sourceList[from.index];
		const dest = destList[to.index];
		if (!source?.itemId || source.count <= 1) return;
		if (dest?.itemId) return;
		if (ITEMS[source.itemId].maxStack <= 1) return;
		const moveCount = Math.floor(source.count / 2);
		if (moveCount <= 0) return;
		const nextGrid = [...state.grid];
		const nextHotbar = [...state.hotbar];
		const getList = (area: SlotArea) =>
			area === "grid" ? nextGrid : nextHotbar;
		getList(from.area)[from.index] = {
			itemId: source.itemId,
			count: source.count - moveCount,
		};
		getList(to.area)[to.index] = { itemId: source.itemId, count: moveCount };
		set({ grid: nextGrid, hotbar: nextHotbar });
	},

	addItem: (itemId, count) => {
		if (count <= 0) return 0;
		const max = ITEMS[itemId].maxStack;
		const nextGrid = [...get().grid];
		const nextHotbar = [...get().hotbar];
		let remaining = count;
		const areas: InventorySlot[][] = [nextHotbar, nextGrid];
		if (max > 1) {
			for (const list of areas) {
				for (let i = 0; i < list.length && remaining > 0; i += 1) {
					const slot = list[i];
					if (slot.itemId === itemId && slot.count < max) {
						const space = max - slot.count;
						const take = Math.min(space, remaining);
						list[i] = { itemId, count: slot.count + take };
						remaining -= take;
					}
				}
			}
		}
		for (const list of areas) {
			for (let i = 0; i < list.length && remaining > 0; i += 1) {
				if (!list[i].itemId) {
					const take = Math.min(max, remaining);
					list[i] = { itemId, count: take };
					remaining -= take;
				}
			}
		}
		set({ grid: nextGrid, hotbar: nextHotbar });
		return remaining;
	},

	removeItem: (itemId, count) => {
		if (count <= 0) return 0;
		const nextGrid = [...get().grid];
		const nextHotbar = [...get().hotbar];
		let remaining = count;
		const areas: InventorySlot[][] = [nextHotbar, nextGrid];
		for (const list of areas) {
			for (let i = 0; i < list.length && remaining > 0; i += 1) {
				const slot = list[i];
				if (slot.itemId !== itemId) continue;
				const take = Math.min(slot.count, remaining);
				list[i] =
					slot.count - take <= 0
						? emptySlot()
						: { itemId, count: slot.count - take };
				remaining -= take;
			}
		}
		set({ grid: nextGrid, hotbar: nextHotbar });
		return count - remaining;
	},

	removeAt: (ref, count) => {
		const state = get();
		const list = slotsOf(state, ref.area);
		const slot = list[ref.index];
		if (!slot?.itemId) return;
		const next = Math.max(0, slot.count - count);
		const nextGrid = [...state.grid];
		const nextHotbar = [...state.hotbar];
		const target = ref.area === "grid" ? nextGrid : nextHotbar;
		target[ref.index] =
			next <= 0 ? emptySlot() : { itemId: slot.itemId, count: next };
		set({ grid: nextGrid, hotbar: nextHotbar });
	},

	grantAllItems: () => {
		const { grid, hotbar } = buildAdminInventory();
		set({
			grid,
			hotbar,
			selectedHotbar: 0,
			inventoryOpen: false,
		});
	},

	setItemCount: (itemId, count) => {
		const state = get();
		const keepsEmptySlot = itemId === "fence" || itemId === "gate";
		const next = reconcileItemCount(
			state.grid,
			state.hotbar,
			itemId,
			count,
			keepsEmptySlot,
		);
		set({ grid: next.grid, hotbar: next.hotbar });
	},

	hydrateInventory: (slots, seeds) => {
		const snapshot = layoutFromSnapshot(slots);
		const base =
			snapshot.occupied > 0
				? snapshot
				: { grid: buildInitialGrid(), hotbar: buildInitialHotbar() };
		const { grid, hotbar } = applySeedCounts(base.grid, base.hotbar, seeds);
		set({ grid, hotbar, inventoryHydrated: true, inventorySynced: true });
	},

	hydrateSeeds: (seeds) => {
		const { grid, hotbar } = applySeedCounts(get().grid, get().hotbar, seeds);
		set({ grid, hotbar, inventoryHydrated: true });
	},

	markInventoryHydrated: () => set({ inventoryHydrated: true }),

	resetInventory: () =>
		set({
			grid: buildInitialGrid(),
			hotbar: buildInitialHotbar(),
			selectedHotbar: 0,
			inventoryOpen: false,
			inventoryHydrated: false,
			inventorySynced: false,
		}),
}));

/**
 * Excalibur scene polls this to freeze movement while an overlay captures
 * input (inventory modal or pause menu).
 */
export function isInventoryBlockingInput(): boolean {
	return (
		useInventoryStore.getState().inventoryOpen ||
		usePauseStore.getState().paused
	);
}

export function countItem(
	state: Pick<InventoryState, "grid" | "hotbar">,
	itemId: ItemId,
): number {
	let total = 0;
	for (const slot of [...state.grid, ...state.hotbar]) {
		if (slot.itemId === itemId) total += slot.count;
	}
	return total;
}
