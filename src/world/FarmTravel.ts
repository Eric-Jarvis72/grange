import type * as ex from "excalibur";
import type { InputManager } from "./InputManager";
import { isNearFarmTrain } from "./mapData";
import type { TrainController } from "./train";
import type { WorldArea } from "./WalkingScene";

export class FarmTravel {
	private activePrompt: string | null = null;

	constructor(
		private readonly onPromptChange: (prompt: string | null) => void,
		private readonly onAreaChange: (area: WorldArea) => void,
		private readonly onOpenMenu: () => void,
	) {}

	activate(): void {
		this.onAreaChange("Farm");
		this.setPrompt(null);
	}

	update(
		player: ex.Actor,
		input: InputManager,
		train: TrainController,
		gatePrompt: string | null = null,
		housePrompt: string | null = null,
		onOpenHouse: (() => void) | null = null,
	): void {
		// A nearby gate owns the prompt and the E key while it is in range.
		if (gatePrompt) {
			this.setPrompt(gatePrompt);
			return;
		}
		if (housePrompt && onOpenHouse) {
			this.setPrompt(housePrompt);
			if (input.consumePress("KeyE", "Enter")) onOpenHouse();
			return;
		}
		const canBoard = isNearFarmTrain(player.pos.x, player.pos.y) && train.canBoard();
		this.setPrompt(canBoard ? "Press E or Enter to board the train" : null);
		if (!canBoard) return;
		if (!input.consumePress("KeyE", "Enter")) return;
		this.setPrompt(null);
		this.onOpenMenu();
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
