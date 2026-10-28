export interface InputVector {
	x: number;
	y: number;
}

export class InputManager {
	private readonly activeKeys = new Set<string>();
	private readonly pressedKeys = new Set<string>();
	private readonly boundKeyDown: (event: KeyboardEvent) => void;
	private readonly boundKeyUp: (event: KeyboardEvent) => void;
	private readonly boundBlur: () => void;

	constructor() {
		this.boundKeyDown = (event) => {
			if (
				["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space"].includes(
					event.code,
				)
			) {
				event.preventDefault();
			}
			if (!this.activeKeys.has(event.code)) this.pressedKeys.add(event.code);
			this.activeKeys.add(event.code);
		};

		this.boundKeyUp = (event) => {
			this.activeKeys.delete(event.code);
		};

		this.boundBlur = () => {
			this.activeKeys.clear();
			this.pressedKeys.clear();
		};

		window.addEventListener("keydown", this.boundKeyDown);
		window.addEventListener("keyup", this.boundKeyUp);
		window.addEventListener("blur", this.boundBlur);
	}

	getMovementVector(): InputVector {
		let x = 0;
		let y = 0;
		if (this.activeKeys.has("KeyA") || this.activeKeys.has("ArrowLeft")) x -= 1;
		if (this.activeKeys.has("KeyD") || this.activeKeys.has("ArrowRight"))
			x += 1;
		if (this.activeKeys.has("KeyW") || this.activeKeys.has("ArrowUp")) y -= 1;
		if (this.activeKeys.has("KeyS") || this.activeKeys.has("ArrowDown")) y += 1;

		const length = Math.hypot(x, y);
		return length > 0 ? { x: x / length, y: y / length } : { x, y };
	}

	consumePressed(code: string): boolean {
		return this.consumePress(code);
	}

	consumePress(...codes: string[]): boolean {
		const pressed = codes.some((code) => this.pressedKeys.has(code));
		for (const code of codes) this.pressedKeys.delete(code);
		return pressed;
	}

	/**
	 * Forgets queued presses without touching held keys. Used when an overlay
	 * takes over so a key still held on close cannot immediately re-trigger.
	 */
	clearPressed(): void {
		this.pressedKeys.clear();
	}

	destroy(): void {
		window.removeEventListener("keydown", this.boundKeyDown);
		window.removeEventListener("keyup", this.boundKeyUp);
		window.removeEventListener("blur", this.boundBlur);
		this.activeKeys.clear();
		this.pressedKeys.clear();
	}
}
