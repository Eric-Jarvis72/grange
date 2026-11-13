import type * as ex from "excalibur";
import { useInventoryStore } from "../inventory/inventoryStore";
import type { ItemId } from "../inventory/items";
import { opensBarn } from "./barnActions";
import type { FarmPropLayer } from "./farmPropLayer";
import type { InputManager } from "./InputManager";

const PROMPT = "Press E to open the barn";

/**
 * The barn's interaction: the owner sees a prompt while standing at the barn
 * and opens storage with E. A plain click on the barn opens it too, for mouse
 * players. Mirrors FarmTravel so FarmMapScene only wires it up.
 */
export class FarmBarn {
	constructor(private readonly isOwner: boolean) {}

	/** The interact prompt to show while the owner stands at the barn. */
	prompt(player: ex.Actor, props: FarmPropLayer): string | null {
		const near = this.isOwner && props.barnNear(player.pos.x, player.pos.y);
		return near ? PROMPT : null;
	}

	/** Opens on E at the barn; run after gate input so a gate wins. Fishing
	 * drains E when the barn is out of reach, so only claim it here. */
	update(player: ex.Actor, input: InputManager, props: FarmPropLayer): void {
		const near = this.isOwner && props.barnNear(player.pos.x, player.pos.y);
		if (!near || !input.consumePress("KeyE")) return;
		this.open();
	}

	/** Opens on a click that lands on the barn; true when it handled the click. */
	handleClick(
		worldPos: ex.Vector,
		item: ItemId | null,
		props: FarmPropLayer,
	): boolean {
		const target = props.pick(worldPos.x, worldPos.y);
		if (!opensBarn(this.isOwner, item, target?.asset)) return false;
		this.open();
		return true;
	}

	private open(): void {
		useInventoryStore.getState().setBarnOpen(true);
	}
}
