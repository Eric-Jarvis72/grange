import * as ex from "excalibur";
import { bankInterior } from "./bankResources";
import { MAP_HEIGHT, MAP_WIDTH } from "./mapData";
import { MARKETPLACE_BANK_ENTRANCE } from "./marketplaceData";
import { WalkingScene, type WorldArea } from "./WalkingScene";

export type BankDesk = "teller" | "mayor";

/** The interior artwork includes both characters and their labeled desks. */
export class BankScene extends WalkingScene {
	constructor(onPromptChange: (prompt: string | null) => void,
		onAreaChange: (area: WorldArea) => void, onTalk: (desk: BankDesk) => void) {
		super({
			area: "Bank",
			spawn: ex.vec(576, 650),
			obstacles: [
				{ left: 0, right: 1152, top: 0, bottom: 345 },
				{ left: 0, right: 70, top: 0, bottom: 768 },
				{ left: 1080, right: 1152, top: 0, bottom: 768 },
			],
			interactions: [
				{ position: ex.vec(576, 700), destination: "marketplace",
					destinationSpawn: { x: MARKETPLACE_BANK_ENTRANCE.x, y: MARKETPLACE_BANK_ENTRANCE.y + 60 },
					prompt: "Press E or Enter to leave the bank", radius: 60 },
				{ position: ex.vec(440, 390), prompt: "Press E or Enter to talk to bank teller",
					radius: 125, action: () => onTalk("teller") },
				{ position: ex.vec(960, 390), prompt: "Press E or Enter to talk to mayor",
					radius: 125, action: () => onTalk("mayor") },
			],
			onAreaChange,
			onPromptChange,
		});
	}

	override onInitialize(): void {
		this.backgroundColor = ex.Color.fromHex("#9d724a");
		this.addImage(bankInterior, MAP_WIDTH / 2, MAP_HEIGHT - 5, MAP_WIDTH, 0);
		this.addPlayer();
	}

	private addImage(source: ex.ImageSource, x: number, y: number, width: number, z: number): void {
		const sprite = source.toSprite();
		const scale = width / source.width;
		sprite.scale = ex.vec(scale, scale);
		const actor = new ex.Actor({ pos: ex.vec(x, y), anchor: ex.vec(0.5, 1), z });
		actor.graphics.use(sprite);
		this.add(actor);
	}
}
