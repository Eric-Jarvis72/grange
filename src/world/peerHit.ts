/** Remote farmer sprites are 64x64 and anchored at the avatar's feet. */
export const PEER_HIT_WIDTH = 64;
export const PEER_HIT_HEIGHT = 64;

/**
 * True when a world-space click lands on a remote farmer.
 *
 * Presence positions are the avatar's feet, so the hit box extends upward from
 * that point. Kept pure so the comic bonk path stays testable without a canvas.
 */
export function peerHit(
	peer: { x: number; y: number },
	x: number,
	y: number,
): boolean {
	return (
		Math.abs(x - peer.x) <= PEER_HIT_WIDTH / 2 &&
		y >= peer.y - PEER_HIT_HEIGHT &&
		y <= peer.y
	);
}
