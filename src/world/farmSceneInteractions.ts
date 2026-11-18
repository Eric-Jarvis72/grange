import type * as ex from "excalibur";
import type { ActiveFarm } from "../../shared/types";
import type { FarmBarn } from "./FarmBarn";
import type { FarmTravel } from "./FarmTravel";
import type { FarmFishing } from "./farmFishing";
import type { FarmNpc } from "./farmNpc";
import { npcAnchor, npcPrompt } from "./farmNpcPosition";
import type { FarmPropLayer } from "./farmPropLayer";
import { nearbyGate, toggleGate } from "./gateInteraction";
import type { InputManager } from "./InputManager";
import { shouldShowNpc } from "./npcStore";
import type { TrainController } from "./train";

export interface FarmInteractionArgs {
	owner: string;
	isOwner: boolean;
	player: ex.Actor;
	input: InputManager;
	train: TrainController;
	travel: FarmTravel;
	barn: FarmBarn;
	fishing: FarmFishing;
	farmProps: FarmPropLayer;
	farm: ActiveFarm | null;
	npc?: FarmNpc;
	onTalkToNpc: () => void;
	onOpenHouse: () => void;
	report: (text: string) => void;
}

/** Resolves the frame's gate, farmhand, house, barn, and fishing input. */
export function updateFarmInteractions(args: FarmInteractionArgs): void {
	const gate = nearbyGate(args.farm?.gates ?? [], args.player.pos);
	const house = args.farmProps.position("farmhouse");
	const npc = shouldShowNpc(args.isOwner) ? npcAnchor(house) : null;
	args.npc?.place(npc);
	args.travel.update(
		args.player,
		args.input,
		args.train,
		gate?.prompt ?? args.barn.prompt(args.player, args.farmProps),
		npcPrompt(args.player.pos, npc),
		args.onTalkToNpc,
		args.travel.housePrompt(args.isOwner, args.player.pos, house),
		args.onOpenHouse,
	);
	if (gate && args.input.consumePress("KeyE", "Enter")) {
		toggleGate(args.owner, gate.gate, args.report);
	}
	args.barn.update(args.player, args.input, args.farmProps);
	args.fishing.update(args.player.pos.y, args.input);
}
