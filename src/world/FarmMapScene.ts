import * as ex from "excalibur";
import { type FarmToolId, isFarmInBounds } from "../../shared/farm";
import { useGameStore } from "../store";
import { isInventoryBlockingInput } from "../inventory/inventoryStore";
import { BlockRegistry } from "./blocking";
import { ComboController } from "./farmCombo";
import { useComboStore } from "./comboStore";
import { CropLayer } from "./cropLayer";
import { FenceLayer } from "./fenceRendering";
import { actOnFence, selectedFarmItem } from "./fenceActions";
import { performFarmAction } from "./farmActionRunner";
import { handleFarmPropClick } from "./farmPropActions";
import { FarmPropLayer } from "./farmPropLayer";
import { FarmTravel } from "./FarmTravel";
import { addFarmerGraphics, updateFarmerGraphics } from "./farmerSprite";
import type { FarmHoveredTile, FarmHudSnapshot } from "./farmHud";
import { TOOL_HINTS } from "./farmTools";
import { FarmTileSync } from "./farmSceneTiles";
import { InputManager } from "./InputManager";
import {
	FARM_PLAYER_SPAWN,
	MAP_COLUMNS,
	MAP_HEIGHT,
	MAP_ROWS,
	MAP_WIDTH,
	TILE_SIZE,
	terrainAt,
} from "./mapData";
import { updateFarmPlayer } from "./playerMovement";
import { terrainFrames, terrainImage } from "./resources";
import { SweepFx } from "./sweepFx";
import type { WorldArea } from "./WalkingScene";

const FARM_TOOLS = ["hoe", "seed-bag", "watering-can", "scythe"];

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
	private readonly fences = new FenceLayer(this, this.blocks);
	private readonly farmProps = new FarmPropLayer(this, this.blocks);

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
		});

		// Populate saved farm props and their collision/tool footprints.
		this.farmProps.set(useGameStore.getState().activeFarm?.prop_overrides ?? []);
		this.fences.set(useGameStore.getState().activeFarm?.fences ?? []);

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
			if (this.deactivated || isInventoryBlockingInput()) return;
			const item = selectedFarmItem();
			this.painting = FARM_TOOLS.includes(item ?? "");
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
		this.farmProps.set(useGameStore.getState().activeFarm?.prop_overrides ?? []);
		this.fences.set(useGameStore.getState().activeFarm?.fences ?? []);

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
		if (!this.isOwner) return;
		if (!FARM_TOOLS.includes(selectedFarmItem() ?? "")) return;
		if (this.inputManager.consumePressed("Space")) this.actOnPlayerTile();
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

		const item = selectedFarmItem();
		if (
			handleFarmPropClick(
				item,
				worldPos,
				this.farmProps,
				useGameStore.getState().activeFarm,
				this.owner,
				this.player.pos,
				(message) => this.report(message),
			)
		)
			return;

		if (item === "fence" || item === "shovel") {
			actOnFence(this.owner, column, row, item, this.blocks, this.player.pos, (message) =>
				this.report(message),
			);
			return;
		}
		if (!item) {
			this.report("Select a tool or item first.");
			return;
		}

		if (this.blocks.isBlocked(column, row)) {
			this.report("Something is in the way.");
			return;
		}
		if (!isFarmInBounds(column, row)) {
			this.report("Too far out to farm.");
			return;
		}
		this.performAction(column, row);
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
