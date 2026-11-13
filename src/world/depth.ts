/**
 * World depth shared by props and walking actors.
 *
 * Props are drawn at `100 + floor(y)` so anything lower on the screen overlaps
 * anything above it. Player avatars must use the same band or they render
 * behind every prop regardless of where they stand.
 */
export function depthForY(y: number): number {
	return 100 + Math.floor(y);
}
