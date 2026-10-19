import * as ex from "excalibur";
import { updateFarmerGraphics } from "./farmerSprite";
import { FARM_TRAIN_ARRIVAL_SPAWN } from "./mapData";
import type { MarketId } from "./marketData";
import {
	MARKETPLACE_CASINO_ENTRANCE,
	MARKETPLACE_PLAYER_SPAWN,
	MARKETPLACE_PRODUCE_MARKET_ENTRANCE,
	MARKETPLACE_SEED_MARKET_ENTRANCE,
	MARKETPLACE_TRAIN_STOP,
	marketplaceProps,
	marketplaceTerrainAt,
} from "./marketplaceData";
import { marketplaceImages } from "./marketplaceResources";
import { marketplaceWalkObstacles } from "./sceneObstacles";
import { addProps, addTerrain } from "./sceneRendering";
import { findTrainRest, TrainController } from "./train";
import {
	type SceneActivationData,
	WalkingScene,
	type WorldArea,
} from "./WalkingScene";

export class MarketplaceScene extends WalkingScene {
	private train?: TrainController;

	constructor(
		onPromptChange: (prompt: string | null) => void,
		onAreaChange: (area: WorldArea) => void,
		onOpenMarket: (market: MarketId) => void,
	) {
		super({
			area: "Marketplace",
			spawn: ex.vec(MARKETPLACE_PLAYER_SPAWN.x, MARKETPLACE_PLAYER_SPAWN.y),
			obstacles: marketplaceWalkObstacles,
			interactions: [
				{
					position: ex.vec(MARKETPLACE_TRAIN_STOP.x, MARKETPLACE_TRAIN_STOP.y),
					destination: "farm-map",
					destinationSpawn: {
						x: FARM_TRAIN_ARRIVAL_SPAWN.x,
						y: FARM_TRAIN_ARRIVAL_SPAWN.y,
					},
					prompt: "Press E or Enter to return to the farm",
					canInteract: () => this.train?.canBoard() ?? false,
					trainArriving: true,
					onTravel: () => this.departTrain(),
				},
				{
					position: ex.vec(
						MARKETPLACE_CASINO_ENTRANCE.x,
						MARKETPLACE_CASINO_ENTRANCE.y,
					),
					destination: "casino",
					prompt: "Press E or Enter to enter the casino",
					radius: 105,
				},
				{
					position: ex.vec(
						MARKETPLACE_SEED_MARKET_ENTRANCE.x,
						MARKETPLACE_SEED_MARKET_ENTRANCE.y,
					),
					prompt: "Press E or Enter to enter the seed market",
					radius: 95,
					action: () => onOpenMarket("seed"),
				},
				{
					position: ex.vec(
						MARKETPLACE_PRODUCE_MARKET_ENTRANCE.x,
						MARKETPLACE_PRODUCE_MARKET_ENTRANCE.y,
					),
					prompt: "Press E or Enter to enter the produce market",
					radius: 95,
					action: () => onOpenMarket("produce"),
				},
			],
			onAreaChange,
			onPromptChange,
		});
	}

	override onInitialize(): void {
		this.backgroundColor = ex.Color.fromHex("#79a44d");
		addTerrain(this, marketplaceTerrainAt);
		addProps(this, marketplaceProps, marketplaceImages);
		this.train = new TrainController(findTrainRest(marketplaceProps), this);
		this.addPlayer();
	}

	override onActivate(
		context: ex.SceneActivationContext<SceneActivationData>,
	): void {
		super.onActivate(context);
		this.train?.reset(context.data?.trainArriving ?? false);
	}

	override onPreUpdate(engine: ex.Engine, delta: number): void {
		this.train?.update(delta);
		if (!(this.train?.isParked() ?? true)) {
			this.player.graphics.visible = false;
			this.player.vel = ex.Vector.Zero;
			updateFarmerGraphics(this.player, { x: 0, y: 0 });
			return;
		}
		super.onPreUpdate(engine, delta);
		this.player.graphics.visible = true;
	}

	/** Plays the train's departure, resolving once it has left the screen. */
	private departTrain(): Promise<void> {
		return new Promise((resolve) => {
			if (!this.train) return resolve();
			this.train.depart(resolve);
		});
	}
}
