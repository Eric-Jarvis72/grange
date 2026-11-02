import * as ex from "excalibur";
import {
	LIVESTOCK_EXIT,
	LIVESTOCK_SPAWN,
	livestockPens,
	livestockWalkObstacles,
	type AnimalId,
} from "./livestockData";
import {
	livestockAnimalImages,
	livestockInteriorImage,
	livestockPenImage,
	livestockSignImages,
	livestockTroughImage,
} from "./livestockResources";
import { MAP_HEIGHT, MAP_WIDTH } from "./mapData";
import { MARKETPLACE_LIVESTOCK_ENTRANCE } from "./marketplaceData";
import { WalkingScene, type WorldArea } from "./WalkingScene";

export class LivestockMarketScene extends WalkingScene {
	constructor(
		onPromptChange: (prompt: string | null) => void,
		onAreaChange: (area: WorldArea) => void,
		onOpenPen: (animal: AnimalId) => void,
	) {
		super({
			area: "Livestock Market",
			spawn: ex.vec(LIVESTOCK_SPAWN.x, LIVESTOCK_SPAWN.y),
			obstacles: livestockWalkObstacles,
			interactions: [
				{
					position: ex.vec(LIVESTOCK_EXIT.x, LIVESTOCK_EXIT.y),
					destination: "marketplace",
					destinationSpawn: { x: MARKETPLACE_LIVESTOCK_ENTRANCE.x, y: MARKETPLACE_LIVESTOCK_ENTRANCE.y + 48 },
					prompt: "Press E or Enter to leave the livestock market",
					radius: 54,
				},
				...livestockPens.map((pen) => ({
					position: ex.vec(pen.approachX, pen.approachY),
					prompt: `Press E or Enter to buy a ${pen.name.toLowerCase()} ($${pen.price})`,
					radius: 68,
					action: () => onOpenPen(pen.id),
				})),
			],
			onAreaChange,
			onPromptChange,
		});
	}

	override onInitialize(): void {
		this.backgroundColor = ex.Color.fromHex("#342317");
		this.addImage(livestockInteriorImage, MAP_WIDTH / 2, MAP_HEIGHT, MAP_WIDTH, 0);
		for (const pen of livestockPens) this.addPen(pen);
		this.addPlayer();
	}

	private addPen(pen: (typeof livestockPens)[number]): void {
		this.addImage(livestockAnimalImages[pen.id], pen.x, pen.y - 76, pen.animalWidth, 10);
		this.addImage(livestockTroughImage, pen.x + 88, pen.y - 56, 62, 12);
		this.addImage(livestockPenImage, pen.x, pen.y, pen.width, 30);
		const signX = pen.x < MAP_WIDTH / 2 ? pen.x + 160 : pen.x - 160;
		this.addImage(livestockSignImages[pen.id], signX, pen.y - 8, 48, 40);
	}

	private addImage(
		source: ex.ImageSource,
		x: number,
		y: number,
		width: number,
		z: number,
	): void {
		const sprite = source.toSprite();
		const scale = width / source.width;
		sprite.scale = ex.vec(scale, scale);
		const actor = new ex.Actor({ pos: ex.vec(x, y), anchor: ex.vec(0.5, 1), z });
		actor.graphics.use(sprite);
		this.add(actor);
	}
}
