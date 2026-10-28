import type { InputManager } from "./InputManager";
import { isNearWater } from "./mapData";

/**
 * Offers shoreline fishing on the farm. Owns the "Press E to fish" prompt,
 * arbitrating it against the train travel prompt, opens the fishing overlay on
 * a fresh E press, and remembers whether the overlay has paused the scene.
 * Kept separate from FarmMapScene so that class stays within the file budget.
 */
export class FarmFishing {
	private travel: string | null = null;
	private ready = false;
	private paused = false;
	private published: string | null = null;

	constructor(
		private readonly isOwner: boolean,
		private readonly onOpen: () => void,
		private readonly publish: (prompt: string | null) => void,
	) {}

	/** True while the fishing overlay owns input. */
	get isPaused(): boolean {
		return this.paused;
	}

	/** Routes the train travel prompt so fishing can defer to it. */
	setTravelPrompt(prompt: string | null): void {
		this.travel = prompt;
		this.flush();
	}

	/** Called each frame after travel; opens fishing on a fresh E press. */
	update(y: number, input: InputManager): void {
		const near = this.isOwner && isNearWater(y);
		if (near !== this.ready) {
			this.ready = near;
			this.flush();
		}
		// Always drain the key so a press made away from the water cannot
		// linger and fire the moment the player reaches the shore.
		const pressed = input.consumePressed("KeyE");
		if (near && pressed) this.onOpen();
	}

	setPaused(paused: boolean): void {
		if (this.paused === paused) return;
		this.paused = paused;
		if (paused && this.ready) {
			this.ready = false;
			this.flush();
		}
	}

	private flush(): void {
		const next = this.travel ?? (this.ready ? "Press E to fish" : null);
		if (next === this.published) return;
		this.published = next;
		this.publish(next);
	}
}
