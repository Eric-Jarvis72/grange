import * as ex from "excalibur";
import { type FarmToolId, isFarmInBounds } from "../../shared/farm";
import { useGameStore } from "../store";
import { isInventoryBlockingInput } from "../inventory/inventoryStore";
import { farmToolForItem } from "../inventory/items";
import { BlockRegistry } from "./blocking";
import { ComboController } from "./farmCombo";
import { useComboStore } from "./comboStore";
import { CropLayer } from "./cropLayer";
import { FenceLayer } from "./fenceRendering";
import { FencePlacementPreview } from "./FencePlacementPreview";
import { actOnFence, selectedFarmItem } from "./fenceActions";
import { performFarmAction } from "./farmActionRunner";
import { handleFarmPropClick, placeFarmProp } from "./farmPropActions";
import { FarmPropLayer } from "./farmPropLayer";
import { FarmPlacementPreview } from "./FarmPlacementPreview";
import { FarmTravel } from "./FarmTravel";
import { FarmFishing } from "./farmFishing";
import { addFarmerGraphics, updateFarmerGraphics } from "./farmerSprite";
import { HorseRiding } from "./horseRiding";
import type { FarmHudSnapshot } from "./farmHud";
import { FarmSceneHud } from "./farmSceneHud";
import { TOOL_HINTS } from "./farmTools";
import { FarmTileSync } from "./farmSceneTiles";
import { nearbyGate, toggleGate } from "./gateInteraction";
import { farmActionOnSpace } from "./farmSceneInput";
import { InputManager } from "./InputManager";
import {
	FARM_PLAYER_SPAWN,
	MAP_COLUMNS,
	MAP_HEIGHT,
	MAP_ROWS,
	MAP_WIDTH,
	props,
	isMovablePropAsset,
	TILE_SIZE,
} from "./mapData";
import { buildTerrain } from "./farmTerrain";
import { farmWalkObstacles } from "./sceneObstacles";
import { SweepFx } from "./sweepFx";
import { findTrainRest, TrainController } from "./train";
import type { SceneActivationData, WorldArea } from "./WalkingScene";

export class FarmMapScene extends ex.Scene<SceneActivationData> {
	onFarmUpdate: ((snapshot: FarmHudSnapshot) => void) | null = null;

	private inputManager!: InputManager;
	private player!: ex.Actor;
	private sheet!: ex.SpriteSheet;
	private terrain!: ex.TileMap;
	private tileSync!: FarmTileSync;
	private readonly crops = new CropLayer(this);
	private readonly sweepFx = new SweepFx(this);
	private readonly combo = new ComboController();
	private readonly blocks = new BlockRegistry();
	private readonly fences = new FenceLayer(this, this.blocks);
	private readonly farmProps = new FarmPropLayer(this, this.blocks);
	private readonly placement = new FarmPlacementPreview(this, this.farmProps);
	private readonly fencePlacement = new FencePlacementPreview(this);

	private painting = false;
	private readonly strokeTiles = new Set<string>();
	private deactivated = false;
	private readonly hud: FarmSceneHud;
	private readonly travel: FarmTravel;
	private readonly riding: HorseRiding;
	private readonly fishing: FarmFishing;
	private train!: TrainController;

	constructor(
		private readonly owner: string,
		private readonly isOwner: boolean,
		onPromptChange: (prompt: string | null) => void,
		onAreaChange: (area: WorldArea) => void,
		onFish: () => void,
	) {
		super();
		this.fishing = new FarmFishing(
			isOwner,
			onFish,
			(prompt) => onPromptChange(prompt),
		);
		this.travel = new FarmTravel(
			(prompt) => this.fishing.setTravelPrompt(prompt),
			onAreaChange,
		);
		this.riding = new HorseRiding(onPromptChange);
		this.hud = new FarmSceneHud(TOOL_HINTS.hoe, (snapshot) =>
			this.onFarmUpdate?.(snapshot));
	}

	override onInitialize(engine: ex.Engine): void {
		this.backgroundColor = ex.Color.fromHex("#79a44d");
		this.inputManager = new InputManager();

		const { sheet, tileMap } = buildTerrain();
		this.sheet = sheet;
		this.terrain = tileMap;
		this.add(this.terrain);

		this.tileSync = new FarmTileSync({
			terrain: this.terrain,
			sheet: this.sheet,
			crops: this.crops,
		});

		// Populate saved farm props and their collision/tool footprints.
		this.farmProps.set(useGameStore.getState().activeFarm?.prop_overrides ?? []);
		const farm = useGameStore.getState().activeFarm;
		this.fences.set(farm?.fences ?? [], farm?.gates ?? []);

		// The train is animated separately from the static prop layer.
		this.train = new TrainController(findTrainRest(props), this);

		// 4. Create Player Actor
		this.player = new ex.Actor({
			pos: ex.vec(FARM_PLAYER_SPAWN.x, FARM_PLAYER_SPAWN.y),
			width: 32,
			height: 32,
			anchor: ex.vec(0.5, 1),
			z: 200,
		});
		addFarmerGraphics(this.player);
		this.add(this.player);

		// 5. Populate the grazing horses.
		this.riding.spawn(this, farmWalkObstacles);

		const pointers = engine.input.pointers;
		pointers.primary.on("down", (evt) => {
			if (this.deactivated || isInventoryBlockingInput()) return;
			const item = selectedFarmItem();
			const farm = useGameStore.getState().activeFarm;
			if (item && isMovablePropAsset(item) && this.isOwner && farm) {
				if ((farm.prop_inventory[item] ?? 0) > 0)
					this.placement.start(item, evt.worldPos, this.player.pos, farm);
				else this.hud.setMessage(`No ${item} in inventory.`);
				return;
			}
			if (item === "fence" && this.isOwner && farm)
				return this.fencePlacement.start(evt.worldPos, farm, this.blocks, this.player.pos);
			this.painting = farmToolForItem(item) !== null;
			this.strokeTiles.clear();
			this.applyToolAt(evt.worldPos);
		});
		pointers.primary.on("move", (evt) => {
			if (this.deactivated) return;
			this.hud.updateHover(evt.worldPos);
			const farm = useGameStore.getState().activeFarm;
			if (this.placement.active && farm)
				this.placement.update(evt.worldPos, this.player.pos, farm);
			if (this.fencePlacement.active && farm)
				this.fencePlacement.update(evt.worldPos, farm, this.blocks, this.player.pos);
			if (this.painting) this.applyToolAt(evt.worldPos);
		});
		pointers.primary.on("up", (evt) => {
			const farm = useGameStore.getState().activeFarm;
			if (this.placement.active && farm && !this.deactivated && !isInventoryBlockingInput() &&
				selectedFarmItem() === this.placement.selectedAsset) {
				const result = this.placement.finish(evt.worldPos, this.player.pos, farm);
				if (result) placeFarmProp(result.asset, result.placement, farm,
					this.owner, (message) => this.hud.setMessage(message));
			} else this.placement.clear();
			if (this.fencePlacement.active && farm && !this.deactivated &&
				!isInventoryBlockingInput() && selectedFarmItem() === "fence") {
				this.fencePlacement.release(evt.worldPos, farm, this.blocks, this.player.pos,
					this.owner, (message) => this.hud.setMessage(message));
			} else this.fencePlacement.clear();
			this.painting = false;
			this.strokeTiles.clear();
		});

		this.camera.pos = ex.vec(MAP_WIDTH / 2, MAP_HEIGHT / 2);
		this.setHeldTool(farmToolForItem(selectedFarmItem()));
	}

	setHeldTool(tool: FarmToolId | null): void {
		this.hud.setMessage(tool ? TOOL_HINTS[tool] : "Select a tool or item first.");
	}

	/** The hotbar reports a slot change so the combo tracker grants its grace. */
	noteHotbarSwap(): void {
		this.combo.noteHotbarSwap();
	}

	override onActivate(
		context: ex.SceneActivationContext<SceneActivationData>,
	): void {
		if (this.deactivated) this.inputManager = new InputManager();
		this.deactivated = false;
		this.travel.activate();
		this.train.reset(context.data?.trainArriving ?? false);
	}

	override onPreUpdate(engine: ex.Engine, delta: number): void {
		if (this.placement.active && (isInventoryBlockingInput() ||
			selectedFarmItem() !== this.placement.selectedAsset)) this.placement.clear();
		if (this.fencePlacement.active && (isInventoryBlockingInput() ||
			selectedFarmItem() !== "fence")) this.fencePlacement.clear();
		this.train.update(delta);
		this.player.graphics.visible = this.train.isParked() && !this.riding.isMounted();
		const farm = useGameStore.getState().activeFarm;
		this.farmProps.set(farm?.prop_overrides ?? []);
		this.fences.set(farm?.fences ?? [], farm?.gates ?? []);

		// Freeze and hide the player while the inventory modal captures input,
		// while the fishing overlay is open, or while the train carries them.
		if (
			isInventoryBlockingInput() ||
			this.fishing.isPaused ||
			!this.train.isParked()
		) {
			this.player.vel = ex.vec(0, 0);
			updateFarmerGraphics(this.player, { x: 0, y: 0 });
			return;
		}

		const dir = this.inputManager.getMovementVector();

		const gate = nearbyGate(farm?.gates ?? [], this.player.pos);
		this.travel.update(this.player, this.inputManager, engine, this.train, gate?.prompt ?? null);
		if (gate && this.inputManager.consumePress("KeyE", "Enter")) {
			toggleGate(this.owner, gate.gate, (message) => this.hud.setMessage(message));
		}
		this.riding.update(this.player, this.inputManager, dir, delta, this.combo.moveSpeed);
		this.fishing.update(this.player.pos.y, this.inputManager);

		if (this.isOwner) farmActionOnSpace(this.inputManager, this.player.pos,
			(column, row) => this.performAction(column, row));
		this.syncTilesFromServer();
		this.tileSync.syncGrowing(useGameStore.getState().activeFarm, Date.now());
		this.sweepFx.update(delta);
		this.combo.update();
	}

	/** Freezes the scene while the fishing overlay is open. */
	setOverlayPaused(paused: boolean): void {
		this.fishing.setPaused(paused);
		// Drop keys pressed while the overlay had the keyboard so a held F
		// cannot reopen the overlay the moment control returns.
		this.inputManager?.clearPressed();
		if (paused) {
			this.player.vel = ex.vec(0, 0);
			updateFarmerGraphics(this.player, { x: 0, y: 0 });
		}
	}

	override onDeactivate(): void {
		this.deactivated = true;
		this.placement.clear();
		this.fencePlacement.clear();
		this.painting = false;
		this.inputManager?.destroy();
		this.travel.deactivate();
		this.riding.deactivate(this.player);
		useComboStore.getState().clearCombo();
	}

	private applyToolAt(worldPos: ex.Vector): void {
		const column = Math.floor(worldPos.x / TILE_SIZE);
		const row = Math.floor(worldPos.y / TILE_SIZE);
		this.hud.updateHover(worldPos);
		if (column < 0 || row < 0 || column >= MAP_COLUMNS || row >= MAP_ROWS)
			return;

		const strokeKey = `${column},${row}`;
		if (this.strokeTiles.has(strokeKey)) return;
		this.strokeTiles.add(strokeKey);

		if (!this.isOwner) {
			this.hud.setMessage("Visitors can't farm here.");
			return;
		}

		const item = selectedFarmItem();
		if (
			handleFarmPropClick(
				item,
				worldPos,
				this.farmProps,
				useGameStore.getState().activeFarm,
				this.owner,
				(message) => this.hud.setMessage(message),
			)
		)
			return;

		if (item === "gate" || item === "shovel") {
			actOnFence(this.owner, column, row, item, this.blocks, this.player.pos, (message) =>
				this.hud.setMessage(message),
			);
			return;
		}
		if (!item) {
			this.hud.setMessage("Select a tool or item first.");
			return;
		}

		if (this.blocks.isBlocked(column, row)) {
			this.hud.setMessage("Something is in the way.");
			return;
		}
		if (!isFarmInBounds(column, row)) {
			this.hud.setMessage("Too far out to farm.");
			return;
		}
		this.performAction(column, row);
	}

	private performAction(column: number, row: number): void {
		performFarmAction(this.owner, this.combo, this.sweepFx, column, row, {
			message: (text) => this.hud.setMessage(text),
			shake: () => this.camera.shake(2, 2, 180),
		});
	}

	private syncTilesFromServer(): void {
		const changed = this.tileSync.sync(useGameStore.getState().activeFarm);
		if (!changed) return;
		this.hud.refresh();
	}
}
