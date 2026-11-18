import type * as ex from "excalibur";
import type { InputManager } from "./InputManager";
import { FARM_HOUSE_REACH, isNearFarmTrain } from "./mapData";
import type { TrainController } from "./train";
import type { WorldArea } from "./WalkingScene";

interface ScenePosition {
	x: number;
	y: number;
}

export class FarmTravel {
	private activePrompt: string | null = null;

	constructor(
		private readonly onPromptChange: (prompt: string | null) => void,
		private readonly onAreaChange: (area: WorldArea) => void,
		private readonly onOpenMenu: () => void,
	) {}

	/**
	 * The farmhouse prompt when the owner stands close enough to its prop, else
	 * null. Lives here because this class owns prompt priority.
	 */
	housePrompt(
		isOwner: boolean,
		player: ScenePosition,
		house: ScenePosition | null,
	): string | null {
		if (!isOwner || !house) return null;
		const distance = Math.hypot(player.x - house.x, player.y - house.y);
		return distance <= FARM_HOUSE_REACH
			? "Press E or Enter to enter the farmhouse"
			: null;
	}

	activate(): void {
		this.onAreaChange("Farm");
		this.setPrompt(null);
	}

	update(
		player: ex.Actor,
		input: InputManager,
		train: TrainController,
		gatePrompt: string | null = null,
		npcPrompt: string | null = null,
		onTalkToNpc: (() => void) | null = null,
		housePrompt: string | null = null,
		onOpenHouse: (() => void) | null = null,
	): void {
		// A nearby gate owns the prompt and the E key while it is in range.
		if (gatePrompt) {
			this.setPrompt(gatePrompt);
			return;
		}
		// The farmhand stands beside the house, so he gets first claim on E
		// before the house menu.
		if (npcPrompt && onTalkToNpc) {
			this.setPrompt(npcPrompt);
			if (input.consumePress("KeyE", "Enter")) onTalkToNpc();
			return;
		}
		if (housePrompt && onOpenHouse) {
			this.setPrompt(housePrompt);
			if (input.consumePress("KeyE", "Enter")) onOpenHouse();
			return;
		}
		const canBoard =
			isNearFarmTrain(player.pos.x, player.pos.y) && train.canBoard();
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
