import * as ex from "excalibur";
import type { FarmToolId } from "../../shared/farm";
import { useGameStore } from "../store";
import { isEmoteWheelOpen } from "../emotes/emoteStore";
import { isInventoryBlockingInput } from "../inventory/inventoryStore";
import { farmToolForItem } from "../inventory/items";
import { BlockRegistry } from "./blocking";
import { ComboController } from "./farmCombo";
import { useComboStore } from "./comboStore";
import { CropLayer } from "./cropLayer";
import { FenceLayer } from "./fenceRendering";
import { FencePlacementPreview } from "./FencePlacementPreview";
import { FrameClock } from "./frameClock";
import { SprinklerPlacementPreview } from "./SprinklerPlacementPreview";
import { SprinklerLayer } from "./sprinklerRendering";
import { selectedFarmItem } from "./fenceActions";
import { performFarmAction } from "./farmActionRunner";
import { FarmPropLayer } from "./farmPropLayer";
import { FarmPlacementPreview } from "./FarmPlacementPreview";
import { FarmTravel } from "./FarmTravel";
import { FarmFishing } from "./farmFishing";
import { farmHousePrompt } from "./farmHousePrompt";
import { canEditFarm } from "./farmPermissions";
import { FarmEmotes } from "./farmSceneEmotes";
import { FarmScenePresence } from "./farmScenePresence";
import { FarmToolInput } from "./farmToolInput";
import { freezeFarmer, updateFarmerGraphics } from "./farmerSprite";
import { createFarmPlayer, followFarmPlayer } from "./farmSceneSetup";
import { hoveredFarmTile, type FarmHoveredTile, type FarmHudSnapshot } from "./farmHud";
import { TOOL_HINTS } from "./farmTools";
import { FarmTileSync } from "./farmSceneTiles";
import { nearbyGate, toggleGate } from "./gateInteraction";
import { farmActionOnSpace } from "./farmSceneInput";
import { InputManager } from "./InputManager";
import { buildTerrain, paintFarmTerrain } from "./farmTerrain";
import {
	MAP_HEIGHT,
	MAP_WIDTH,
	props,
} from "./mapData";
import { updateFarmPlayer } from "./playerMovement";
import { setFarmLandLevel } from "./sceneObstacles";
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
	private readonly sprinklers = new SprinklerLayer(this);
	private readonly sprinklerPlacement = new SprinklerPlacementPreview(this);
	private paintedLandLevel = -1;
	private toolInput!: FarmToolInput;
	private message = TOOL_HINTS.hoe;
	private hovered: FarmHoveredTile | null = null;
	private lastWorldPos: ex.Vector | null = null;
	private deactivated = false;
	private readonly travel: FarmTravel;
	private readonly fishing: FarmFishing;
	private readonly onOpenHouse: () => void;
	private train!: TrainController;
	private presence?: FarmScenePresence;
	private emotes!: FarmEmotes;
	private paused = false;
	/** Wall-clock gameplay step; see `frameClock.ts`. */
	private readonly frameClock = new FrameClock();

	constructor(
		private readonly owner: string,
		private readonly isOwner: boolean,
		onPromptChange: (prompt: string | null) => void,
		onAreaChange: (area: WorldArea) => void,
		onFish: () => void,
		onOpenHouse: () => void,
		onOpenTravel: () => void,
	) {
		super();
		this.onOpenHouse = onOpenHouse;
		this.fishing = new FarmFishing(
			isOwner,
			onFish,
			(prompt) => onPromptChange(prompt),
		);
		this.travel = new FarmTravel(
			(prompt) => this.fishing.setTravelPrompt(prompt),
			onAreaChange,
			onOpenTravel,
		);
	}

	override onInitialize(engine: ex.Engine): void {
		this.backgroundColor = ex.Color.fromHex("#79a44d");
		this.inputManager = new InputManager();

		this.paintedLandLevel = useGameStore.getState().activeFarm?.land_level ?? 0;
		const { sheet, tileMap } = buildTerrain(this.paintedLandLevel);
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
		setFarmLandLevel(farm?.land_level ?? 0);
		this.fences.set(farm?.fences ?? [], farm?.gates ?? []);
		this.sprinklers.set(farm?.sprinklers ?? []);

		// The train is animated separately from the static prop layer.
		this.train = new TrainController(findTrainRest(props), this);

		this.player = createFarmPlayer(this);
		this.presence = new FarmScenePresence(this, this.player);
		this.emotes = new FarmEmotes(this.player, () => this.canOpenEmotes());

		this.toolInput = new FarmToolInput({
			owner: this.owner,
			player: this.player,
			blocks: this.blocks,
			farmProps: this.farmProps,
			placement: this.placement,
			fencePlacement: this.fencePlacement,
			sprinklerPlacement: this.sprinklerPlacement,
			canEdit: () => this.canEdit(),
			isDeactivated: () => this.deactivated,
			report: (message) => this.report(message),
			reportReadOnly: () => this.reportReadOnly(),
			updateHover: (pos) => this.updateHover(pos),
			performAction: (column, row) => this.performAction(column, row),
		});
		this.toolInput.attach(engine);

		this.camera.pos = ex.vec(MAP_WIDTH / 2, MAP_HEIGHT / 2);
		this.setHeldTool(farmToolForItem(selectedFarmItem()));
	}

	setHeldTool(tool: FarmToolId | null): void {
		this.message = tool ? TOOL_HINTS[tool] : "Select a tool or item first.";
		this.emitHud();
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
		this.paused = false;
		this.frameClock.reset();
		this.travel.activate();
		this.train.reset(context.data?.trainArriving ?? false);
		this.presence?.update(0);
		this.emotes.attach();
	}

	override onPreUpdate(_engine: ex.Engine, _delta: number): void {
		const step = this.frameClock.step();
		if (this.emotes.handle(this.inputManager)) return;
		if (
			this.placement.active &&
			(isInventoryBlockingInput() ||
				selectedFarmItem() !== this.placement.selectedAsset)
		) {
			this.placement.clear();
		}
		if (
			this.fencePlacement.active &&
			(isInventoryBlockingInput() || selectedFarmItem() !== "fence")
		) {
			this.fencePlacement.clear();
		}
		if (
			this.sprinklerPlacement.active &&
			(isInventoryBlockingInput() || selectedFarmItem() !== "sprinkler")
		) {
			this.sprinklerPlacement.clear();
		}
		this.train.update(step);
		this.player.graphics.visible = this.train.isParked();
		const farm = useGameStore.getState().activeFarm;
		setFarmLandLevel(farm?.land_level ?? 0);
		if ((farm?.land_level ?? 0) !== this.paintedLandLevel) {
			this.paintedLandLevel = farm?.land_level ?? 0;
			paintFarmTerrain(this.terrain, this.sheet, this.paintedLandLevel);
			this.tileSync.repaint(farm);
		}
		this.farmProps.set(farm?.prop_overrides ?? []);
		this.fences.set(farm?.fences ?? [], farm?.gates ?? []);
		this.sprinklers.set(farm?.sprinklers ?? []);
		this.sprinklers.update(step);
		this.presence?.update(step);

		// Freeze and hide the player while the inventory modal captures input,
		// while a farmhouse/train menu is open, while the fishing overlay is
		// open, or while the train carries them.
		if (
			this.paused ||
			isInventoryBlockingInput() ||
			isEmoteWheelOpen() ||
			this.fishing.isPaused ||
			!this.train.isParked()
		) {
			freezeFarmer(this.player);
			return;
		}

		const dir = this.inputManager.getMovementVector();
		this.emotes.cancelOnAction(this.inputManager);
		updateFarmPlayer(this.player, dir, step, this.combo.moveSpeed, farm?.land_level ?? 0);
		followFarmPlayer(this.camera, this.player.pos, farm?.land_level ?? 0);
		updateFarmerGraphics(this.player, dir);

		const gate = nearbyGate(farm?.gates ?? [], this.player.pos);
		const housePrompt = this.housePrompt();
		this.travel.update(
			this.player,
			this.inputManager,
			this.train,
			gate?.prompt ?? null,
			housePrompt,
			this.onOpenHouse,
		);
		if (gate && this.inputManager.consumePress("KeyE", "Enter")) {
			toggleGate(this.owner, gate.gate, (message) => this.report(message));
		}
		this.fishing.update(this.player.pos.y, this.inputManager);

		if (this.canEdit()) farmActionOnSpace(this.inputManager, this.player.pos,
			(column, row) => this.performAction(column, row));
		this.syncTilesFromServer();
		this.tileSync.syncGrowing(useGameStore.getState().activeFarm, Date.now());
		this.sweepFx.update(step);
		this.combo.update();
	}

	/** Freezes the scene while the fishing overlay is open. */
	setOverlayPaused(paused: boolean): void {
		this.fishing.setPaused(paused);
		// Drop keys pressed while the overlay had the keyboard so a held F
		// cannot reopen the overlay the moment control returns.
		this.inputManager?.clearPressed();
		if (paused) freezeFarmer(this.player);
	}

	/** Freezes movement while a farmhouse or train-menu overlay is open. */
	setMenuPaused(paused: boolean): void {
		this.paused = paused;
		this.inputManager?.clearPressed();
		if (paused) freezeFarmer(this.player);
	}

	private canOpenEmotes(): boolean {
		return !this.paused && !this.fishing.isPaused && this.train.isParked() && !isInventoryBlockingInput();
	}

	/** Plays the train's departure, resolving once it has left the screen. */
	async departTrain(): Promise<void> {
		if (!this.train.canBoard()) return;
		await new Promise<void>((resolve) => this.train.depart(resolve));
	}

	override onDeactivate(): void {
		this.deactivated = true;
		this.emotes.detach();
		this.placement.clear();
		this.fencePlacement.clear();
		this.sprinklerPlacement.clear();
		this.toolInput?.clear();
		this.inputManager?.destroy();
		this.travel.deactivate();
		this.presence?.clear();
		useComboStore.getState().clearCombo();
	}

	private canEdit(): boolean {
		return canEditFarm(useGameStore.getState().activeFarm, this.isOwner);
	}

	private reportReadOnly(): void {
		this.report("The owner has visitor editing off.");
	}

	private housePrompt(): string | null {
		return farmHousePrompt(this.isOwner, this.farmProps, this.player.pos);
	}

	private performAction(column: number, row: number): void {
		performFarmAction(this.owner, this.combo, this.sweepFx, column, row, {
			message: (text) => this.report(text),
			shake: () => this.camera.shake(2, 2, 180),
		});
	}

	private report(text: string): void {
		this.message = text;
		this.emitHud();
	}

	private syncTilesFromServer(): void {
		const changed = this.tileSync.sync(useGameStore.getState().activeFarm);
		if (!changed) return;
		if (this.lastWorldPos) this.updateHover(this.lastWorldPos);
		else this.emitHud();
	}

	private updateHover(worldPos: ex.Vector): void {
		this.lastWorldPos = worldPos.clone();
		this.hovered = hoveredFarmTile(worldPos.x, worldPos.y,
			useGameStore.getState().activeFarm);
		this.emitHud();
	}

	private emitHud(): void {
		const farm = useGameStore.getState().activeFarm;
		this.onFarmUpdate?.({
			tomatoes: farm?.tomatoes ?? 0,
			message: this.message,
			hovered: this.hovered,
		});
	}
}
