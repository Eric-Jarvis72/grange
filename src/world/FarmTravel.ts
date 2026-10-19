import type * as ex from "excalibur";
import type { InputManager } from "./InputManager";
import { isNearFarmTrain } from "./mapData";
import type { TrainController } from "./train";
import type { WorldArea } from "./WalkingScene";

export class FarmTravel {
	private activePrompt: string | null = null;
	private traveling = false;

	constructor(
		private readonly onPromptChange: (prompt: string | null) => void,
		private readonly onAreaChange: (area: WorldArea) => void,
	) {}

	activate(): void {
		this.traveling = false;
		this.onAreaChange("Farm");
		this.setPrompt(null);
	}

	update(
		player: ex.Actor,
		input: InputManager,
		engine: ex.Engine,
		train: TrainController,
	): void {
		const nearTrain = isNearFarmTrain(player.pos.x, player.pos.y);
		const canBoard = nearTrain && train.canBoard();
		this.setPrompt(
			canBoard ? "Press E or Enter to travel to the marketplace" : null,
		);
		if (!canBoard || this.traveling) return;
		if (!input.consumePress("KeyE", "Enter")) return;
		this.traveling = true;
		this.setPrompt(null);
		// Ride the train out, then hand off to the marketplace, which slides the
		// train back in from off-screen.
		train.depart(() => {
			void engine.goToScene("marketplace", {
				sceneActivationData: { trainArriving: true },
			});
		});
	}

	deactivate(): void {
		this.setPrompt(null);
	}

	private setPrompt(prompt: string | null): void {
		if (this.activePrompt === prompt) return;
		this.activePrompt = prompt;
		this.onPromptChange(prompt);
	}
}
