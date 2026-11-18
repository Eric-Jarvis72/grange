import * as ex from "excalibur";
import {
	CASINO_BLACKJACK_TABLE,
	CASINO_EXIT,
	CASINO_PLAYER_SPAWN,
	CASINO_POKER_TABLE,
	CASINO_ROULETTE_TABLE,
	CASINO_SLOT_MACHINES,
	casinoProps,
} from "./casinoData";
import { casinoImages } from "./casinoResources";
import { MAP_COLUMNS, MAP_ROWS, TILE_SIZE } from "./mapData";
import { MARKETPLACE_CASINO_ENTRANCE } from "./marketplaceData";
import { casinoWalkObstacles } from "./sceneObstacles";
import { addProps } from "./sceneRendering";
import { WalkingScene, type WorldArea } from "./WalkingScene";

export class CasinoScene extends WalkingScene {
	constructor(
		onPromptChange: (prompt: string | null) => void,
		onAreaChange: (area: WorldArea) => void,
		onBlackjack: () => void,
		onPoker: () => void,
		onRoulette: () => void,
		onSlots: () => void,
	) {
		super({
			area: "Casino",
			spawn: ex.vec(CASINO_PLAYER_SPAWN.x, CASINO_PLAYER_SPAWN.y),
			hubArea: "casino",
			obstacles: casinoWalkObstacles,
			interactions: [
				{
					position: ex.vec(CASINO_EXIT.x, CASINO_EXIT.y),
					destination: "marketplace",
					destinationSpawn: {
						x: MARKETPLACE_CASINO_ENTRANCE.x,
						y: MARKETPLACE_CASINO_ENTRANCE.y + 55,
					},
					prompt: "Press E or Enter to leave the casino",
					radius: 85,
				},
				{
					position: ex.vec(CASINO_BLACKJACK_TABLE.x, CASINO_BLACKJACK_TABLE.y),
					prompt: "Press E or Enter to play blackjack",
					radius: 115,
					action: onBlackjack,
				},
				{
					position: ex.vec(CASINO_POKER_TABLE.x, CASINO_POKER_TABLE.y),
					prompt: "Press E or Enter to play poker",
					radius: 115,
					action: onPoker,
				},
				{
					position: ex.vec(CASINO_ROULETTE_TABLE.x, CASINO_ROULETTE_TABLE.y),
					prompt: "Press E or Enter to play roulette",
					radius: 145,
					action: onRoulette,
				},
				{
					position: ex.vec(CASINO_SLOT_MACHINES.x, CASINO_SLOT_MACHINES.y),
					prompt: "Press E or Enter to play the slots",
					radius: 180,
					action: onSlots,
				},
			],
			onAreaChange,
			onPromptChange,
		});
	}

	override onInitialize(): void {
		this.backgroundColor = ex.Color.fromHex("#3a241b");
		this.addFloor();
		for (const x of [205, 576, 947]) this.addRug(x, 350);
		addProps(this, casinoProps, casinoImages);
		this.addPlayer();
	}

	private addFloor(): void {
		const floor = new ex.TileMap({
			pos: ex.vec(0, 0),
			tileWidth: TILE_SIZE,
			tileHeight: TILE_SIZE,
			columns: MAP_COLUMNS,
			rows: MAP_ROWS,
			renderFromTopOfGraphic: true,
		});
		const sprite = casinoImages["wood-dark"].toSprite();
		sprite.scale = ex.vec(
			TILE_SIZE / casinoImages["wood-dark"].width,
			TILE_SIZE / casinoImages["wood-dark"].height,
		);
		for (let row = 0; row < MAP_ROWS; row += 1) {
			for (let column = 0; column < MAP_COLUMNS; column += 1) {
				floor.getTile(column, row)?.addGraphic(sprite.clone());
			}
		}
		this.add(floor);
	}

	private addRug(x: number, y: number): void {
		const source = casinoImages["rug-square"];
		const sprite = source.toSprite();
		sprite.scale = ex.vec(300 / source.width, 250 / source.height);
		const actor = new ex.Actor({ pos: ex.vec(x, y), z: 1 });
		actor.graphics.use(sprite);
		this.add(actor);
	}
}
