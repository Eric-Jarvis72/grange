import * as ex from "excalibur";
import { depthForY } from "./depth";
import { FARM_NPC_NAME, type NpcAnchor } from "./farmNpcPosition";
import { createNameLabel } from "./nameLabel";

export const FARM_NPC_WIDTH = 44;
export const FARM_NPC_HEIGHT = 64;

/**
 * The placeholder farmhand: a plain wooden square with a name tag, drawn in the
 * same depth band as props so he sorts correctly as the player walks around.
 *
 * He has no collision (remote avatars do not either) and simply hides when the
 * owner finishes the quest or moves the farmhouse into their inventory.
 */
export class FarmNpc {
	private readonly body: ex.Actor;
	private readonly label: ex.Actor;
	private shown = false;

	constructor(scene: ex.Scene) {
		this.body = new ex.Actor({
			pos: ex.vec(0, 0),
			width: FARM_NPC_WIDTH,
			height: FARM_NPC_HEIGHT,
			anchor: ex.vec(0.5, 1),
			z: depthForY(0),
		});
		this.body.graphics.use(
			new ex.Rectangle({
				width: FARM_NPC_WIDTH,
				height: FARM_NPC_HEIGHT,
				color: ex.Color.fromHex("#8a5a34"),
				strokeColor: ex.Color.fromHex("#2b1709"),
				lineWidth: 4,
			}),
		);

		this.body.graphics.visible = false;
		this.label = createNameLabel(FARM_NPC_NAME, "#ffd76e");
		this.label.graphics.visible = false;

		scene.add(this.body);
		scene.add(this.label);
	}

	/** Moves him to `position`, or hides him when it is null. */
	place(position: NpcAnchor | null): void {
		this.setShown(position !== null);
		if (!position) return;
		this.body.pos = ex.vec(position.x, position.y);
		this.body.z = depthForY(position.y);
		this.label.pos = ex.vec(position.x, position.y - FARM_NPC_HEIGHT - 6);
		this.label.z = this.body.z + 1;
	}

	private setShown(shown: boolean): void {
		if (shown === this.shown) return;
		this.shown = shown;
		this.body.graphics.visible = shown;
		this.label.graphics.visible = shown;
	}
}
