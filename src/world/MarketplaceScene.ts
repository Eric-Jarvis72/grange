import * as ex from "excalibur";
import { updateFarmerGraphics } from "./farmerSprite";
import type { MarketId } from "./marketData";
import {
	MARKETPLACE_CASINO_ENTRANCE,
	MARKETPLACE_LIVESTOCK_ENTRANCE,
	MARKETPLACE_BANK_ENTRANCE,
	MARKETPLACE_HARDWARE_ENTRANCE,
	MARKETPLACE_COLUMNS,
	MARKETPLACE_WIDTH,
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
		onOpenTravel: () => void,
	) {
		super({
			area: "Marketplace",
			spawn: ex.vec(MARKETPLACE_PLAYER_SPAWN.x, MARKETPLACE_PLAYER_SPAWN.y),
			hubArea: "marketplace",
			obstacles: marketplaceWalkObstacles,
			worldWidth: MARKETPLACE_WIDTH,
			interactions: [
				{
					position: ex.vec(MARKETPLACE_TRAIN_STOP.x, MARKETPLACE_TRAIN_STOP.y),
					prompt: "Press E or Enter to board the train",
					canInteract: () => this.train?.canBoard() ?? false,
					action: onOpenTravel,
				},
				{
					position: ex.vec(MARKETPLACE_BANK_ENTRANCE.x, MARKETPLACE_BANK_ENTRANCE.y),
					destination: "bank",
					prompt: "Press E or Enter to enter the bank",
					radius: 72,
				},
				{
					position: ex.vec(
						MARKETPLACE_HARDWARE_ENTRANCE.x,
						MARKETPLACE_HARDWARE_ENTRANCE.y,
					),
					prompt: "Press E or Enter to shop at the hardware store",
					radius: 95,
					action: () => onOpenMarket("hardware"),
				},
				{
					position: ex.vec(
						MARKETPLACE_LIVESTOCK_ENTRANCE.x,
						MARKETPLACE_LIVESTOCK_ENTRANCE.y,
					),
					destination: "livestock-market",
					prompt: "Press E or Enter to enter the livestock market",
					radius: 72,
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
		addTerrain(this, marketplaceTerrainAt, MARKETPLACE_COLUMNS);
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

	override onPreUpdate(engine: ex.Engine, _delta: number): void {
		// One wall-clock step for both the train and the walk.
		const step = this.frameClock.step();
		this.train?.update(step);
		if (!(this.train?.isParked() ?? true)) {
			this.player.graphics.visible = false;
			this.player.vel = ex.Vector.Zero;
			updateFarmerGraphics(this.player, { x: 0, y: 0 });
			// Keep the hub live while the local player rides the train.
			this.updateHub(step);
			return;
		}
		this.player.graphics.visible = true;
		this.walkFrame(engine, step);
	}

	/** Plays the train's departure, resolving once it has left the screen. */
	async departTrain(): Promise<void> {
		if (!this.train?.canBoard()) return;
		await new Promise<void>((resolve) => this.train?.depart(resolve));
	}
}
