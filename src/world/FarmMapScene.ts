import * as ex from "excalibur";
import type { CropId } from "../../shared/crops";
import { type FarmToolId, isFarmInBounds } from "../../shared/farm";
import { emitFarmAction } from "../socket";
import { useGameStore } from "../store";
import {
	countItem,
	isInventoryBlockingInput,
	useInventoryStore,
} from "../inventory/inventoryStore";
import { cropForSeedItem, type ItemId } from "../inventory/items";
import { BlockRegistry, decorByTile } from "./blocking";
import { ComboController } from "./farmCombo";
import { useComboStore } from "./comboStore";
import { CropLayer } from "./cropLayer";
import { type ActionPlan, maybeSpread, resolveAction } from "./farmActions";
import { FarmTravel } from "./FarmTravel";
import { addFarmerGraphics, updateFarmerGraphics } from "./farmerSprite";
import type { FarmHoveredTile, FarmHudSnapshot } from "./farmHud";
import { TOOL_HINTS } from "./farmTools";
import { FarmTileSync } from "./farmSceneTiles";
import { InputManager } from "./InputManager";
import {
	FARM_PLAYER_SPAWN,
	isTillableTile,
	MAP_COLUMNS,
	MAP_HEIGHT,
	MAP_ROWS,
	MAP_WIDTH,
	props,
	TILE_SIZE,
	terrainAt,
} from "./mapData";
import { updateFarmPlayer } from "./playerMovement";
import { addFarmProps } from "./propLayer";
import { terrainFrames, terrainImage } from "./resources";
import { SweepFx } from "./sweepFx";
import type { WorldArea } from "./WalkingScene";

export class FarmMapScene extends ex.Scene {
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
	private readonly propActors: Array<ex.Actor | undefined> = [];
	private readonly decor = decorByTile(props);

	private painting = false;
	private readonly strokeTiles = new Set<string>();
	private message = TOOL_HINTS.hoe;
	private hovered: FarmHoveredTile | null = null;
	private lastWorldPos: ex.Vector | null = null;
	private deactivated = false;
	private readonly travel: FarmTravel;

	constructor(
		private readonly owner: string,
		private readonly isOwner: boolean,
		onPromptChange: (prompt: string | null) => void,
		onAreaChange: (area: WorldArea) => void,
	) {
		super();
		this.travel = new FarmTravel(onPromptChange, onAreaChange);
	}

	override onInitialize(engine: ex.Engine): void {
		this.backgroundColor = ex.Color.fromHex("#79a44d");
		this.inputManager = new InputManager();

		this.sheet = ex.SpriteSheet.fromImageSource({
			image: terrainImage,
			grid: {
				rows: 4,
				columns: 4,
				spriteWidth: TILE_SIZE,
				spriteHeight: TILE_SIZE,
			},
		});

		this.terrain = new ex.TileMap({
			pos: ex.vec(0, 0),
			tileWidth: TILE_SIZE,
			tileHeight: TILE_SIZE,
			columns: MAP_COLUMNS,
			rows: MAP_ROWS,
			renderFromTopOfGraphic: true,
		});

		for (let row = 0; row < MAP_ROWS; row += 1) {
			for (let column = 0; column < MAP_COLUMNS; column += 1) {
				const frame = terrainFrames[terrainAt(column, row)];
				this.terrain
					.getTile(column, row)
					?.addGraphic(this.sheet.getSprite(frame.column, frame.row));
			}
		}
		this.add(this.terrain);

		this.tileSync = new FarmTileSync({
			terrain: this.terrain,
			sheet: this.sheet,
			crops: this.crops,
			decor: this.decor,
			propActors: this.propActors,
			props,
		});

		addFarmProps(this, this.blocks, this.propActors);

		this.player = new ex.Actor({
			pos: ex.vec(FARM_PLAYER_SPAWN.x, FARM_PLAYER_SPAWN.y),
			width: 32,
			height: 32,
			anchor: ex.vec(0.5, 1),
			z: 200,
		});
		addFarmerGraphics(this.player);
		this.add(this.player);

		const pointers = engine.input.pointers;
		pointers.primary.on("down", (evt) => {
			if (this.deactivated) return;
			this.painting = true;
			this.strokeTiles.clear();
			this.applyToolAt(evt.worldPos);
		});
		pointers.primary.on("move", (evt) => {
			if (this.deactivated) return;
			this.updateHover(evt.worldPos);
			if (this.painting) this.applyToolAt(evt.worldPos);
		});
		pointers.primary.on("up", () => {
			this.painting = false;
			this.strokeTiles.clear();
		});

		this.camera.pos = ex.vec(MAP_WIDTH / 2, MAP_HEIGHT / 2);
		this.message = TOOL_HINTS[useGameStore.getState().tool] ?? this.message;
		this.emitHud();
	}

	setTool(tool: FarmToolId): void {
		useGameStore.getState().setTool(tool);
		this.message = TOOL_HINTS[tool];
		this.emitHud();
	}

	/** The hotbar reports a slot change so the combo tracker grants its grace. */
	noteHotbarSwap(): void {
		this.combo.noteHotbarSwap();
	}

	override onActivate(): void {
		if (this.deactivated) this.inputManager = new InputManager();
		this.deactivated = false;
		this.travel.activate();
	}

	override onPreUpdate(engine: ex.Engine, delta: number): void {
		if (isInventoryBlockingInput()) {
			this.player.vel = ex.vec(0, 0);
			updateFarmerGraphics(this.player, { x: 0, y: 0 });
			return;
		}

		const dir = this.inputManager.getMovementVector();
		updateFarmPlayer(this.player, dir, delta, this.combo.moveSpeed);
		updateFarmerGraphics(this.player, dir);
		this.travel.update(this.player, this.inputManager, engine);

		this.handleToolKeys();
		this.syncTilesFromServer();
		this.tileSync.syncGrowing(useGameStore.getState().activeFarm, Date.now());
		this.sweepFx.update(delta);
		this.combo.update();
	}

	override onDeactivate(): void {
		this.deactivated = true;
		this.painting = false;
		this.inputManager?.destroy();
		this.travel.deactivate();
		useComboStore.getState().clearCombo();
	}

	private handleToolKeys(): void {
		if (this.isOwner && this.inputManager.consumePressed("Space")) {
			this.actOnPlayerTile();
		}
	}

	private actOnPlayerTile(): void {
		const column = Math.floor(this.player.pos.x / TILE_SIZE);
		const row = Math.floor(this.player.pos.y / TILE_SIZE);
		if (!isFarmInBounds(column, row)) return;
		this.performAction(column, row);
	}

	private applyToolAt(worldPos: ex.Vector): void {
		const column = Math.floor(worldPos.x / TILE_SIZE);
		const row = Math.floor(worldPos.y / TILE_SIZE);
		this.updateHover(worldPos);
		if (column < 0 || row < 0 || column >= MAP_COLUMNS || row >= MAP_ROWS)
			return;

		const strokeKey = `${column},${row}`;
		if (this.strokeTiles.has(strokeKey)) return;
		this.strokeTiles.add(strokeKey);

		if (!this.isOwner) {
			this.message = "Visitors can't farm here.";
			this.emitHud();
			return;
		}
		if (this.blocks.isBlocked(column, row)) {
			this.message = "Something is in the way.";
			this.emitHud();
			return;
		}
		if (!isFarmInBounds(column, row)) {
			this.message = "Too far out to farm.";
			this.emitHud();
			return;
		}
		this.performAction(column, row);
	}

	/** Resolves, validates, and dispatches one tool click on a tile. */
	private performAction(column: number, row: number): void {
		const farm = useGameStore.getState().activeFarm;
		const tile = farm?.tiles.find((t) => t.x === column && t.y === row);
		const tool = useGameStore.getState().tool;
		const resolution = resolveAction(tool, tile, isTillableTile(column, row));

		if (!resolution.ok) {
			this.message = resolution.reason;
			if (resolution.shake) this.camera.shake(2, 2, 180);
			this.emitHud();
			return;
		}

		const plan = resolution.plan;
		let crop: CropId | undefined;
		if (plan.kind === "plant") {
			const seed = this.consumeSeedItem();
			if (!seed) {
				this.message = "Out of seeds — buy more at the market.";
				this.emitHud();
				return;
			}
			crop = seed;
		}

		this.combo.register(plan.kind, tile);
		if (plan.tool === "scythe") {
			this.sweepFx.play(
				column * TILE_SIZE + TILE_SIZE / 2,
				row * TILE_SIZE + TILE_SIZE - 14,
			);
		}
		this.spread(column, row, plan);

		emitFarmAction(this.owner, {
			kind: plan.kind,
			x: column,
			y: row,
			crop,
			tool: plan.tool,
			comboMutationMultiplier: this.combo.mutationMultiplier,
		});
	}

	/** High combos occasionally auto-apply a water or scythe to one neighbour. */
	private spread(column: number, row: number, plan: ActionPlan): void {
		if (plan.kind !== "water" && plan.tool !== "scythe") return;
		const farm = useGameStore.getState().activeFarm;
		const kind = plan.kind === "water" ? "water" : "harvest";
		const multiplier = this.combo.mutationMultiplier;
		maybeSpread(this.combo.current, farm?.tiles ?? [], column, row, kind, plan.tool, (x, y, tool) =>
			emitFarmAction(this.owner, { kind, x, y, tool, comboMutationMultiplier: multiplier }),
		);
	}

	/** Spends one selected seed and returns the crop it plants, if any. */
	private consumeSeedItem(): CropId | null {
		const inventory = useInventoryStore.getState();
		const itemId = inventory.hotbar[inventory.selectedHotbar]?.itemId ?? undefined;
		const crop = cropForSeedItem(itemId);
		if (!crop || !itemId || countItem(inventory, itemId) < 1) return null;
		inventory.removeItem(itemId as ItemId, 1);
		return crop;
	}

	private syncTilesFromServer(): void {
		const changed = this.tileSync.sync(useGameStore.getState().activeFarm);
		if (!changed) return;
		if (this.lastWorldPos) this.updateHover(this.lastWorldPos);
		else this.emitHud();
	}

	private updateHover(worldPos: ex.Vector): void {
		this.lastWorldPos = worldPos.clone();
		const column = Math.floor(worldPos.x / TILE_SIZE);
		const row = Math.floor(worldPos.y / TILE_SIZE);
		if (column < 0 || row < 0 || column >= MAP_COLUMNS || row >= MAP_ROWS) {
			this.hovered = null;
		} else {
			const farm = useGameStore.getState().activeFarm;
			const stored = farm?.tiles.find((t) => t.x === column && t.y === row);
			this.hovered = {
				column,
				row,
				state: stored?.state ?? terrainAt(column, row),
			};
		}
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
