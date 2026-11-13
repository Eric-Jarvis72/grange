import type * as ex from "excalibur";
import { farmToolForItem } from "../inventory/items";
import { isInventoryBlockingInput } from "../inventory/inventoryStore";
import { useGameStore } from "../store";
import type { BlockRegistry } from "./blocking";
import type { FencePlacementPreview } from "./FencePlacementPreview";
import { actOnFence, selectedFarmItem } from "./fenceActions";
import type { FarmBarn } from "./FarmBarn";
import { handleFarmPropClick, placeFarmProp } from "./farmPropActions";
import type { FarmPlacementPreview } from "./FarmPlacementPreview";
import type { FarmPropLayer } from "./farmPropLayer";
import { withinInteractionRange } from "./interaction";
import { actOnSprinkler, sprinklerNear } from "./sprinklerActions";
import type { SprinklerPlacementPreview } from "./SprinklerPlacementPreview";
import {
	isMovablePropAsset,
	ownsFarmTile,
	TILE_SIZE,
} from "./mapData";

/** The scene surfaces the pointer controller is allowed to use. */
export interface FarmToolHost {
	owner: string;
	player: ex.Actor;
	blocks: BlockRegistry;
	farmProps: FarmPropLayer;
	barn: FarmBarn;
	placement: FarmPlacementPreview;
	fencePlacement: FencePlacementPreview;
	sprinklerPlacement: SprinklerPlacementPreview;
	canEdit(): boolean;
	canRearrangeProps(): boolean;
	isDeactivated(): boolean;
	report(text: string): void;
	reportReadOnly(): void;
	updateHover(pos: ex.Vector): void;
	performAction(column: number, row: number): void;
}

/**
 * Owns click/drag farming plus prop and fence placement previews.
 *
 * Extracted from the scene so the pointer plumbing, stroke de-duplication, and
 * permission checks do not crowd the scene's per-frame logic.
 */
export class FarmToolInput {
	private painting = false;
	private readonly strokeTiles = new Set<string>();

	constructor(private readonly host: FarmToolHost) {}

	attach(engine: ex.Engine): void {
		const pointers = engine.input.pointers;
		pointers.primary.on("down", (evt) => {
			if (this.disabled()) return;
			const item = selectedFarmItem();
			if (this.host.barn.handleClick(evt.worldPos, item, this.host.farmProps)) return;
			const farm = useGameStore.getState().activeFarm;
			if (item && isMovablePropAsset(item) && farm) {
				if (!this.mayMoveProps()) return this.host.reportReadOnly();
				if ((farm.prop_inventory[item] ?? 0) > 0)
					this.host.placement.start(item, evt.worldPos, this.host.player.pos, farm);
				else this.host.report(`No ${item} in inventory.`);
				return;
			}
			if (item === "fence" && farm) {
				if (!this.host.canEdit()) return this.host.reportReadOnly();
				return this.host.fencePlacement.start(
					evt.worldPos, farm, this.host.blocks, this.host.player.pos,
				);
			}
			if (item === "sprinkler" && farm) {
				if (!this.host.canEdit()) return this.host.reportReadOnly();
				return this.host.sprinklerPlacement.start(evt.worldPos, farm);
			}
			this.painting = farmToolForItem(item) !== null;
			this.strokeTiles.clear();
			this.applyToolAt(evt.worldPos);
		});
		pointers.primary.on("move", (evt) => {
			if (this.host.isDeactivated()) return;
			this.host.updateHover(evt.worldPos);
			const farm = useGameStore.getState().activeFarm;
			if (this.host.placement.active && farm)
				this.host.placement.update(evt.worldPos, this.host.player.pos, farm);
			if (this.host.fencePlacement.active && farm)
				this.host.fencePlacement.update(evt.worldPos, farm, this.host.blocks, this.host.player.pos);
			if (this.host.sprinklerPlacement.active && farm)
				this.host.sprinklerPlacement.update(evt.worldPos, farm);
			if (this.painting) this.applyToolAt(evt.worldPos);
		});
		pointers.primary.on("up", (evt) => {
			const farm = useGameStore.getState().activeFarm;
			if (this.host.placement.active && farm && !this.disabled() && this.mayMoveProps() &&
				selectedFarmItem() === this.host.placement.selectedAsset) {
				const result = this.host.placement.finish(evt.worldPos, this.host.player.pos, farm);
				if (result) placeFarmProp(result.asset, result.placement, farm,
					this.host.owner, (message) => this.host.report(message));
			} else this.host.placement.clear();
			if (this.host.fencePlacement.active && farm && !this.disabled() && this.host.canEdit() &&
				selectedFarmItem() === "fence") {
				this.host.fencePlacement.release(evt.worldPos, farm, this.host.blocks, this.host.player.pos,
					this.host.owner, (message) => this.host.report(message));
			} else this.host.fencePlacement.clear();
			if (this.host.sprinklerPlacement.active && farm && !this.disabled() && this.host.canEdit() &&
				selectedFarmItem() === "sprinkler") {
				this.host.sprinklerPlacement.release(evt.worldPos, farm, this.host.owner,
					(message) => this.host.report(message));
			} else this.host.sprinklerPlacement.clear();
			this.clear();
		});
	}

	/** Forgets a drag stroke, e.g. when the scene deactivates. */
	clear(): void {
		this.painting = false;
		this.strokeTiles.clear();
	}

	private disabled(): boolean {
		return this.host.isDeactivated() || isInventoryBlockingInput();
	}

	applyAt(worldPos: ex.Vector): void {
		this.applyToolAt(worldPos);
	}

	private mayMoveProps(): boolean {
		return this.host.canEdit() || this.host.canRearrangeProps();
	}

	private applyToolAt(worldPos: ex.Vector): void {
		const column = Math.floor(worldPos.x / TILE_SIZE);
		const row = Math.floor(worldPos.y / TILE_SIZE);
		this.host.updateHover(worldPos);

		if (!withinInteractionRange(this.host.player.pos, worldPos)) {
			this.host.report("Too far away to reach that.");
			return;
		}

		const edit = this.host.canEdit();
		if (!ownsFarmTile(column, row, useGameStore.getState().activeFarm?.land_level ?? 0)) {
			if (!edit) this.host.reportReadOnly();
			return;
		}

		const strokeKey = `${column},${row}`;
		if (this.strokeTiles.has(strokeKey)) return;
		this.strokeTiles.add(strokeKey);

		const item = selectedFarmItem();
		// Admins may rearrange props even on a farm they cannot otherwise edit.
		if (this.mayMoveProps() &&
			handleFarmPropClick(item, worldPos, this.host.farmProps,
				useGameStore.getState().activeFarm, this.host.owner,
				(message) => this.host.report(message)))
			return;

		if (!edit) {
			this.host.reportReadOnly();
			return;
		}

		if (item === "shovel") {
			const active = useGameStore.getState().activeFarm;
			const sprinkler = active ? sprinklerNear(active, worldPos.x, worldPos.y) : null;
			if (sprinkler) {
				actOnSprinkler(this.host.owner, sprinkler.x, sprinkler.y, "shovel",
					(message) => this.host.report(message));
				return;
			}
		}

		if (item === "gate" || item === "shovel") {
			actOnFence(this.host.owner, column, row, item, this.host.blocks, this.host.player.pos,
				(message) => this.host.report(message));
			return;
		}
		if (!item) {
			this.host.report("Select a tool or item first.");
			return;
		}
		if (this.host.blocks.isBlocked(column, row)) {
			this.host.report("Something is in the way.");
			return;
		}
		if (!ownsFarmTile(column, row, useGameStore.getState().activeFarm?.land_level ?? 0)) {
			this.host.report("Too far out to farm.");
			return;
		}
		this.host.performAction(column, row);
	}
}
