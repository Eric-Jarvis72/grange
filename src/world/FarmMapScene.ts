import * as ex from "excalibur";
import type { FarmToolId } from "../../shared/farm";
import { isInventoryBlockingInput } from "../inventory/inventoryStore";
import { farmToolForItem } from "../inventory/items";
import { isNightNow, useGameStore } from "../store";
import { AnimalLayer } from "./AnimalLayer";
import { AnimalPlacementPreview } from "./AnimalPlacementPreview";
import { BlockRegistry } from "./blocking";
import { useComboStore } from "./comboStore";
import { CropLayer } from "./cropLayer";
import { FarmBarn } from "./FarmBarn";
import { FarmPlacementPreview } from "./FarmPlacementPreview";
import { FarmTravel } from "./FarmTravel";
import { FencePlacementPreview } from "./FencePlacementPreview";
import { performFarmAction } from "./farmActionRunner";
import { ComboController } from "./farmCombo";
import { updateFarmerGraphics } from "./farmerSprite";
import { FarmFishing } from "./farmFishing";
import type { FarmHudSnapshot } from "./farmHud";
import { FarmNpc } from "./farmNpc";
import { canEditFarm } from "./farmPermissions";
import { canRearrangeProps } from "./farmPropActions";
import { FarmPropLayer } from "./farmPropLayer";
import { FarmSceneHud } from "./farmSceneHud";
import { farmActionOnSpace } from "./farmSceneInput";
import { updateFarmInteractions } from "./farmSceneInteractions";
import { FarmScenePresence } from "./farmScenePresence";
import { createFarmPlayer, followFarmPlayer } from "./farmSceneSetup";
import { FarmTileSync } from "./farmSceneTiles";
import { buildTerrain, paintFarmTerrain } from "./farmTerrain";
import { FarmToolInput } from "./farmToolInput";
import { selectedFarmItem } from "./fenceActions";
import { FenceLayer } from "./fenceRendering";
import { FrameClock } from "./frameClock";
import { InputManager } from "./InputManager";
import { MAP_HEIGHT, MAP_WIDTH, props } from "./mapData";
import { updateFarmPlayer } from "./playerMovement";
import { SprinklerPlacementPreview } from "./SprinklerPlacementPreview";
import { setFarmLandLevel } from "./sceneObstacles";
import { SprinklerLayer } from "./sprinklerRendering";
import { SweepFx } from "./sweepFx";
import { findTrainRest, TrainController } from "./train";
import { publishViewTransform } from "./viewTransform";
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
	private readonly animals = new AnimalLayer(this);
	private readonly animalPlacement = new AnimalPlacementPreview(this);
	private readonly sprinklerPlacement = new SprinklerPlacementPreview(this);
	private paintedLandLevel = -1;
	private toolInput!: FarmToolInput;
	private readonly hud = new FarmSceneHud((snapshot) =>
		this.onFarmUpdate?.(snapshot),
	);
	private deactivated = false;
	private readonly travel: FarmTravel;
	private readonly barn: FarmBarn;
	private readonly fishing: FarmFishing;
	private readonly onOpenHouse: () => void;
	private readonly onTalkToNpc: () => void;
	private npc?: FarmNpc;
	private train!: TrainController;
	private presence?: FarmScenePresence;
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
		onTalkToNpc: () => void,
		onOpenTravel: () => void,
	) {
		super();
		this.onOpenHouse = onOpenHouse;
		this.onTalkToNpc = onTalkToNpc;
		this.fishing = new FarmFishing(isOwner, onFish, (prompt) =>
			onPromptChange(prompt),
		);
		this.travel = new FarmTravel(
			(prompt) => this.fishing.setTravelPrompt(prompt),
			onAreaChange,
			onOpenTravel,
			isNightNow,
		);
		this.barn = new FarmBarn(isOwner);
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
		this.farmProps.set(
			useGameStore.getState().activeFarm?.prop_overrides ?? [],
		);
		const farm = useGameStore.getState().activeFarm;
		setFarmLandLevel(farm?.land_level ?? 0);
		this.fences.set(farm?.fences ?? [], farm?.gates ?? []);
		this.sprinklers.set(farm?.sprinklers ?? []);
		this.animals.set(farm, this.blocks);

		// The train is animated separately from the static prop layer.
		this.train = new TrainController(findTrainRest(props), this);

		this.player = createFarmPlayer(this);
		this.presence = new FarmScenePresence(this, this.player, (text) =>
			this.hud.report(text),
		);
		this.npc = new FarmNpc(this);

		this.toolInput = new FarmToolInput({
			owner: this.owner,
			player: this.player,
			blocks: this.blocks,
			farmProps: this.farmProps,
			barn: this.barn,
			placement: this.placement,
			fencePlacement: this.fencePlacement,
			sprinklerPlacement: this.sprinklerPlacement,
			animalPlacement: this.animalPlacement,
			animals: this.animals,
			canEdit: () =>
				canEditFarm(useGameStore.getState().activeFarm, this.isOwner),
			canRearrangeProps: () => canRearrangeProps(this.isOwner),
			isDeactivated: () => this.deactivated,
			report: (message) => this.hud.report(message),
			reportReadOnly: () =>
				this.hud.report("The owner has visitor editing off."),
			updateHover: (pos) => this.hud.hover(pos),
			performAction: (column, row) => this.performAction(column, row),
			bonkAt: (pos) => this.presence?.bonkAt(pos.x, pos.y) ?? false,
		});
		this.toolInput.attach(engine);

		this.camera.pos = ex.vec(MAP_WIDTH / 2, MAP_HEIGHT / 2);
		this.setHeldTool(farmToolForItem(selectedFarmItem()));
	}

	setHeldTool(tool: FarmToolId | null): void {
		this.hud.setTool(tool);
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
	}

	override onPreUpdate(engine: ex.Engine, _delta: number): void {
		const step = this.frameClock.step();
		const selected = selectedFarmItem();
		const blocked = isInventoryBlockingInput();
		for (const [preview, item] of [
			[this.placement, this.placement.selectedAsset],
			[this.fencePlacement, "fence"],
			[this.sprinklerPlacement, "sprinkler"],
			[this.animalPlacement, this.animalPlacement.selectedAnimal],
		] as const) {
			if (preview.active && (blocked || selected !== item)) preview.clear();
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
		this.animals.set(farm, this.blocks);
		this.animals.update(step);
		this.presence?.update(step);

		// Freeze and hide the player while the inventory modal captures input,
		// while a farmhouse/train/barn menu is open, while the fishing overlay
		// is open, or while the train carries them. Swallow interact presses so
		// closing an overlay doesn't immediately reopen the barn.
		if (
			this.paused ||
			isInventoryBlockingInput() ||
			this.fishing.isPaused ||
			!this.train.isParked()
		) {
			this.player.vel = ex.vec(0, 0);
			updateFarmerGraphics(this.player, { x: 0, y: 0 });
			this.inputManager.consumePress("KeyE", "Enter");
			return;
		}

		const dir = this.inputManager.getMovementVector();
		updateFarmPlayer(
			this.player,
			dir,
			step,
			this.combo.moveSpeed,
			farm?.land_level ?? 0,
			this.hud.landBorderHint,
		);
		followFarmPlayer(
			this.camera,
			this.player.pos,
			farm?.land_level ?? 0,
			engine,
		);
		publishViewTransform(engine, this.camera);
		updateFarmerGraphics(this.player, dir);

		this.hud.trackPlayer(this.player.pos);

		updateFarmInteractions({
			owner: this.owner,
			isOwner: this.isOwner,
			player: this.player,
			input: this.inputManager,
			train: this.train,
			travel: this.travel,
			barn: this.barn,
			fishing: this.fishing,
			farmProps: this.farmProps,
			farm,
			npc: this.npc,
			onTalkToNpc: this.onTalkToNpc,
			onOpenHouse: this.onOpenHouse,
			report: (message) => this.hud.report(message),
		});

		if (canEditFarm(farm, this.isOwner))
			farmActionOnSpace(this.inputManager, this.player.pos, (column, row) =>
				this.performAction(column, row),
			);
		const changed = this.tileSync.sync(useGameStore.getState().activeFarm);
		if (changed) this.hud.refresh();
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
		if (paused) {
			this.player.vel = ex.vec(0, 0);
			updateFarmerGraphics(this.player, { x: 0, y: 0 });
		}
	}

	/** Freezes movement while a farmhouse or train-menu overlay is open. */
	setMenuPaused(paused: boolean): void {
		this.paused = paused;
		this.inputManager?.clearPressed();
		if (paused) {
			this.player.vel = ex.vec(0, 0);
			updateFarmerGraphics(this.player, { x: 0, y: 0 });
		}
	}

	/** Plays the train's departure, resolving once it has left the screen. */
	async departTrain(): Promise<void> {
		if (!this.train.canBoard()) return;
		await new Promise<void>((resolve) => this.train.depart(resolve));
	}

	override onDeactivate(): void {
		this.deactivated = true;
		this.placement.clear();
		this.fencePlacement.clear();
		this.sprinklerPlacement.clear();
		this.animalPlacement.clear();
		this.toolInput?.clear();
		this.inputManager?.destroy();
		this.travel.deactivate();
		this.presence?.clear();
		useComboStore.getState().clearCombo();
	}

	private performAction(column: number, row: number): void {
		performFarmAction(this.owner, this.combo, this.sweepFx, column, row, {
			message: (text) => this.hud.report(text),
			shake: () => this.camera.shake(2, 2, 180),
		});
	}
}
