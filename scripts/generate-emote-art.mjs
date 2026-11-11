#!/usr/bin/env node
// Generates the placeholder farmer emote atlas under public/assets/player_model.
// Run with `node scripts/generate-emote-art.mjs` (or `pnpm art:emotes`).
//
// The atlas is a uniform 6x6 grid of 64x64 frames, one emote per row, matching
// `shared/emotes.ts`. Replace the generated PNG with hand-authored art using
// the same layout; no code changes are needed.
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { deflateSync } from "node:zlib";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, "public", "assets", "player_model", "farmer-emotes.png");

const FRAME = 64;
const COLUMNS = 6;
const ROWS = 6;
const WIDTH = FRAME * COLUMNS;
const HEIGHT = FRAME * ROWS;

/** Palette sampled from the existing Farmer Forwards sheet. */
const BLACK = [0, 0, 0, 255];
const GOLD = [240, 181, 65, 255];
const LIGHT_GOLD = [255, 238, 131, 255];
const PURPLE = [105, 36, 100, 255];
const DARK_PURPLE = [75, 29, 82, 255];
const BLUE = [104, 111, 153, 255];
const DARK_BLUE = [64, 73, 115, 255];
const SKIN = [189, 106, 98, 255];
const DARK_SKIN = [143, 77, 87, 255];

const pixels = Buffer.alloc(WIDTH * HEIGHT * 4);

function setPixel(x, y, color) {
	if (x < 0 || y < 0 || x >= WIDTH || y >= HEIGHT) return;
	const i = (y * WIDTH + x) * 4;
	pixels[i] = color[0];
	pixels[i + 1] = color[1];
	pixels[i + 2] = color[2];
	pixels[i + 3] = color[3];
}

function rect(ox, oy, x, y, w, h, color) {
	for (let py = y; py < y + h; py++) {
		for (let px = x; px < x + w; px++) setPixel(ox + px, oy + py, color);
	}
}

/** A bordered part: a black silhouette with an inset fill. */
function part(ox, oy, x, y, w, h, fill) {
	rect(ox, oy, x, y, w, h, BLACK);
	if (w > 2 && h > 2) rect(ox, oy, x + 1, y + 1, w - 2, h - 2, fill);
}

function drawArms(ox, oy, arms) {
	for (const arm of [arms.left, arms.right]) {
		if (!arm) continue;
		part(ox, oy, arm.sleeve[0], arm.sleeve[1], arm.sleeve[2], arm.sleeve[3], BLUE);
		part(ox, oy, arm.hand[0], arm.hand[1], arm.hand[2], arm.hand[3], SKIN);
	}
}

function drawLegs(ox, oy, legs) {
	for (const leg of [legs.left, legs.right]) {
		part(ox, oy, leg[0], leg[1], leg[2], leg[3], BLUE);
	}
	for (const foot of [legs.footLeft, legs.footRight]) {
		part(ox, oy, foot[0], foot[1], foot[2], foot[3], DARK_SKIN);
	}
}

/**
 * Draws one farmer pose.
 *
 * Everything above the hips shifts by `bob`; feet and legs are drawn with
 * their own offsets so sitting, jumping, and dancing can move them.
 */
function drawFarmer(ox, oy, pose) {
	const bob = pose.bob ?? 0;
	const headX = pose.headX ?? 0;
	const headY = pose.headY ?? 0;

	drawLegs(ox, oy, pose.legs);
	drawArms(ox, oy, pose.arms);

	const torsoY = 24 + bob;
	part(ox, oy, 22, torsoY, 20, 21, PURPLE);
	rect(ox, oy, 25, torsoY + 2, 3, 17, DARK_PURPLE);
	rect(ox, oy, 36, torsoY + 2, 3, 17, DARK_PURPLE);

	const headTop = 13 + bob + headY;
	part(ox, oy, 24 + headX, headTop, 16, 12, SKIN);
	if (pose.eyesClosed) {
		rect(ox, oy, 27 + headX, headTop + 6, 3, 1, BLACK);
		rect(ox, oy, 34 + headX, headTop + 6, 3, 1, BLACK);
	} else {
		rect(ox, oy, 27 + headX, headTop + 5, 2, 2, BLACK);
		rect(ox, oy, 35 + headX, headTop + 5, 2, 2, BLACK);
	}

	const hatY = 1 + bob + headY;
	const hatX = headX;
	part(ox, oy, 22 + hatX, hatY, 20, 11, GOLD);
	rect(ox, oy, 25 + hatX, hatY + 2, 14, 3, LIGHT_GOLD);
	part(ox, oy, 17 + hatX, hatY + 10, 30, 5, GOLD);
	rect(ox, oy, 20 + hatX, hatY + 11, 24, 1, LIGHT_GOLD);

	if (pose.zzz) {
		rect(ox, oy, 47, 10 + bob, 6, 1, LIGHT_GOLD);
		rect(ox, oy, 52, 9 + bob, 1, 3, LIGHT_GOLD);
		rect(ox, oy, 47, 8 + bob, 1, 1, LIGHT_GOLD);
		rect(ox, oy, 49, 5 + bob, 5, 1, LIGHT_GOLD);
		rect(ox, oy, 53, 4 + bob, 1, 2, LIGHT_GOLD);
		rect(ox, oy, 49, 3 + bob, 1, 1, LIGHT_GOLD);
	}
}

function baseLegs(leftX = 23, rightX = 35, liftLeft = 0, liftRight = 0) {
	return {
		left: [leftX, 44 + liftLeft, 6, 14 - liftLeft],
		right: [rightX, 44 + liftRight, 6, 14 - liftRight],
		footLeft: [leftX - 2, 56 + liftLeft, 10, 7],
		footRight: [rightX - 2, 56 + liftRight, 10, 7],
	};
}

function arm(sleeve, hand) {
	return { sleeve, hand };
}

function normalArms(handY = 39) {
	return {
		left: arm([17, 26, 6, handY - 26], [17, handY, 6, 6]),
		right: arm([41, 26, 6, handY - 26], [41, handY, 6, 6]),
	};
}

const FRAMES = {
	wave: [
		{ bob: 0, arms: { left: arm([17, 26, 6, 13], [17, 39, 6, 6]), right: arm([43, 12, 6, 16], [45, 7, 6, 6]) }, legs: baseLegs() },
		{ bob: -1, arms: { left: arm([17, 26, 6, 13], [17, 39, 6, 6]), right: arm([43, 12, 6, 16], [41, 7, 6, 6]) }, legs: baseLegs() },
		{ bob: 0, arms: { left: arm([17, 26, 6, 13], [17, 39, 6, 6]), right: arm([43, 12, 6, 16], [45, 7, 6, 6]) }, legs: baseLegs() },
		{ bob: -1, arms: { left: arm([17, 26, 6, 13], [17, 39, 6, 6]), right: arm([43, 12, 6, 16], [41, 7, 6, 6]) }, legs: baseLegs() },
	],
	cheer: [
		{ bob: -2, arms: { left: arm([14, 12, 6, 16], [14, 7, 6, 6]), right: arm([44, 12, 6, 16], [44, 7, 6, 6]) }, legs: baseLegs(23, 35, 2, 2) },
		{ bob: 0, arms: { left: arm([14, 14, 6, 14], [14, 9, 6, 6]), right: arm([44, 14, 6, 14], [44, 9, 6, 6]) }, legs: baseLegs() },
		{ bob: -2, arms: { left: arm([14, 12, 6, 16], [14, 7, 6, 6]), right: arm([44, 12, 6, 16], [44, 7, 6, 6]) }, legs: baseLegs(23, 35, 2, 2) },
		{ bob: 0, arms: { left: arm([14, 14, 6, 14], [14, 9, 6, 6]), right: arm([44, 14, 6, 14], [44, 9, 6, 6]) }, legs: baseLegs() },
	],
	dance: [
		{ bob: 0, arms: { left: arm([14, 12, 6, 16], [14, 7, 6, 6]), right: arm([41, 26, 6, 13], [41, 39, 6, 6]) }, legs: baseLegs(23, 35, 0, 2) },
		{ bob: -2, arms: { left: arm([16, 20, 6, 14], [16, 33, 6, 6]), right: arm([42, 20, 6, 14], [42, 33, 6, 6]) }, legs: baseLegs(21, 37) },
		{ bob: 0, arms: { left: arm([17, 26, 6, 13], [17, 39, 6, 6]), right: arm([44, 12, 6, 16], [44, 7, 6, 6]) }, legs: baseLegs(23, 35, 2, 0) },
		{ bob: -2, arms: { left: arm([14, 12, 6, 16], [14, 7, 6, 6]), right: arm([44, 12, 6, 16], [44, 7, 6, 6]) }, legs: baseLegs(21, 37) },
		{ bob: 0, arms: { left: arm([16, 20, 6, 14], [16, 33, 6, 6]), right: arm([42, 20, 6, 14], [42, 33, 6, 6]) }, legs: baseLegs(25, 33, 2, 2) },
		{ bob: -2, arms: { left: arm([17, 26, 6, 13], [17, 39, 6, 6]), right: arm([44, 12, 6, 16], [44, 7, 6, 6]) }, legs: baseLegs(21, 37) },
	],
	sit: [
		{ bob: 10, arms: normalArms(43), legs: seatedLegs(0) },
		{ bob: 9, arms: normalArms(42), legs: seatedLegs(-1) },
		{ bob: 10, arms: normalArms(43), legs: seatedLegs(0) },
		{ bob: 9, arms: normalArms(42), legs: seatedLegs(-1) },
	],
	sleep: [
		{ bob: 14, headX: 0, eyesClosed: true, zzz: true, arms: normalArms(44), legs: seatedLegs(6) },
		{ bob: 15, headX: -1, eyesClosed: true, zzz: true, arms: normalArms(45), legs: seatedLegs(6) },
		{ bob: 14, headX: 0, eyesClosed: true, zzz: true, arms: normalArms(44), legs: seatedLegs(6) },
		{ bob: 15, headX: 1, eyesClosed: true, zzz: true, arms: normalArms(45), legs: seatedLegs(6) },
	],
	shrug: [
		{ bob: -1, arms: shrugArms(0), legs: baseLegs() },
		{ bob: -2, arms: shrugArms(-2), legs: baseLegs() },
		{ bob: -1, arms: shrugArms(0), legs: baseLegs() },
		{ bob: -2, arms: shrugArms(-2), legs: baseLegs() },
	],
};

function seatedLegs(drop) {
	return {
		left: [21, 50 + drop, 13, 7],
		right: [32, 50 + drop, 13, 7],
		footLeft: [21, 56 + drop, 8, 6],
		footRight: [37, 56 + drop, 8, 6],
	};
}

function shrugArms(lift) {
	return {
		left: arm([12, 27 + lift, 11, 5], [7, 25 + lift, 5, 7]),
		right: arm([41, 27 + lift, 11, 5], [52, 25 + lift, 5, 7]),
	};
}

/** Atlas row order; must match `EMOTES` in shared/emotes.ts. */
const EMOTE_ORDER = ["wave", "cheer", "dance", "sit", "sleep", "shrug"];

let row = 0;
for (const id of EMOTE_ORDER) {
	FRAMES[id].forEach((pose, column) => {
		drawFarmer(column * FRAME, row * FRAME, pose);
	});
	row += 1;
}

function crc32(buffer) {
	let crc = 0xffffffff;
	for (const byte of buffer) {
		crc ^= byte;
		for (let bit = 0; bit < 8; bit++) {
			crc = crc & 1 ? (crc >>> 1) ^ 0xedb88320 : crc >>> 1;
		}
	}
	return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
	const typeBytes = Buffer.from(type, "ascii");
	const length = Buffer.alloc(4);
	length.writeUInt32BE(data.length, 0);
	const crc = Buffer.alloc(4);
	crc.writeUInt32BE(crc32(Buffer.concat([typeBytes, data])), 0);
	return Buffer.concat([length, typeBytes, data, crc]);
}

function encodePng(buffer, width, height) {
	const stride = width * 4 + 1;
	const raw = Buffer.alloc(stride * height);
	for (let y = 0; y < height; y++) {
		raw[y * stride] = 0;
		buffer.copy(raw, y * stride + 1, y * width * 4, (y + 1) * width * 4);
	}
	const header = Buffer.alloc(13);
	header.writeUInt32BE(width, 0);
	header.writeUInt32BE(height, 4);
	header[8] = 8;
	header[9] = 6;
	const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
	return Buffer.concat([
		signature,
		chunk("IHDR", header),
		chunk("IDAT", deflateSync(raw)),
		chunk("IEND", Buffer.alloc(0)),
	]);
}

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, encodePng(pixels, WIDTH, HEIGHT));
console.log(`Wrote ${WIDTH}x${HEIGHT} emote atlas to ${OUT}`);
