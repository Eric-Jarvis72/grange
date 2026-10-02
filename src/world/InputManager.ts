export interface InputVector {
  x: number;
  y: number;
}

export class InputManager {
  private activeKeys = new Set<string>();
  private boundKeyDown: (e: KeyboardEvent) => void;
  private boundKeyUp: (e: KeyboardEvent) => void;
  private boundBlur: () => void;

  constructor() {
    this.boundKeyDown = (e: KeyboardEvent) => {
      // Prevent browser scrolling on arrow keys or spacebar
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) {
        e.preventDefault();
      }
      this.activeKeys.add(e.code);
    };

    this.boundKeyUp = (e: KeyboardEvent) => {
      this.activeKeys.delete(e.code);
    };

    // Prevents "stuck keys" if the player Alt-Tabs or clicks away while pressing a key
    this.boundBlur = () => {
      this.activeKeys.clear();
    };

    window.addEventListener('keydown', this.boundKeyDown);
    window.addEventListener('keyup', this.boundKeyUp);
    window.addEventListener('blur', this.boundBlur);
  }

  /**
   * Check if a specific key is currently held down.
   */
  isDown(code: string): boolean {
    return this.activeKeys.has(code);
  }

  /**
   * Returns a normalized 2D direction vector (-1 to 1).
   * Supports both WASD and Arrow Keys.
   */
  getMovementVector(): InputVector {
    let x = 0;
    let y = 0;

    if (this.activeKeys.has('KeyA') || this.activeKeys.has('ArrowLeft'))  x -= 1;
    if (this.activeKeys.has('KeyD') || this.activeKeys.has('ArrowRight')) x += 1;
    if (this.activeKeys.has('KeyW') || this.activeKeys.has('ArrowUp'))    y -= 1;
    if (this.activeKeys.has('KeyS') || this.activeKeys.has('ArrowDown'))  y += 1;

    // Normalize diagonal movement so diagonals aren't 1.414x faster
    const length = Math.hypot(x, y);
    if (length > 0) {
      x /= length;
      y /= length;
    }

    return { x, y };
  }

  /**
   * Clean up event listeners when unmounting or stopping the scene.
   */
  destroy(): void {
    window.removeEventListener('keydown', this.boundKeyDown);
    window.removeEventListener('keyup', this.boundKeyUp);
    window.removeEventListener('blur', this.boundBlur);
    this.activeKeys.clear();
  }
}