import { describe, expect, it } from "vitest";
import { peerHit } from "./peerHit";

const peer = { x: 100, y: 200 };

describe("peerHit", () => {
	it("hits the torso above the avatar's feet", () => {
		expect(peerHit(peer, 100, 170)).toBe(true);
	});

	it("hits the edge of the sprite", () => {
		expect(peerHit(peer, 132, 200)).toBe(true);
		expect(peerHit(peer, 100, 136)).toBe(true);
	});

	it("misses beside or above the sprite", () => {
		expect(peerHit(peer, 133, 170)).toBe(false);
		expect(peerHit(peer, 100, 135)).toBe(false);
	});

	it("misses below the feet", () => {
		expect(peerHit(peer, 100, 201)).toBe(false);
	});
});
