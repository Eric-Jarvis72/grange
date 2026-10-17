import { describe, expect, it } from "vitest";
import {
	CASINO_BLACKJACK_TABLE,
	CASINO_PLAYER_SPAWN,
	CASINO_ROULETTE_TABLE,
} from "./casinoData";
import { FARM_PLAYER_SPAWN, FARM_TRAIN_STOP } from "./mapData";
import { props } from "./mapData";
import { placedFarmProps } from "./farmPropData";
import {
	MARKETPLACE_CASINO_ENTRANCE,
	MARKETPLACE_PLAYER_SPAWN,
	MARKETPLACE_PRODUCE_MARKET_ENTRANCE,
	MARKETPLACE_TRAIN_STOP,
} from "./marketplaceData";
import {
	casinoWalkObstacles,
	farmWalkObstacles,
	marketplaceWalkObstacles,
	setFarmPropObstacles,
} from "./sceneObstacles";
import { moveAroundObstacles, type WalkObstacle } from "./walkCollisions";

const wall: WalkObstacle = { left: 100, right: 200, top: 100, bottom: 200 };

function overlaps(x: number, y: number, box: WalkObstacle): boolean {
	return (
		x + 12 > box.left &&
		x - 12 < box.right &&
		y + 12 > box.top &&
		y - 12 < box.bottom
	);
}

describe("walking collisions", () => {
	function walk(
		start: { x: number; y: number },
		segments: Array<{ x: number; y: number; seconds: number }>,
		obstacles: WalkObstacle[],
	): { x: number; y: number } {
		let point = { ...start };
		for (const segment of segments) {
			const frames = Math.round(segment.seconds * 60);
			for (let frame = 0; frame < frames; frame += 1) {
				point = moveAroundObstacles(
					point.x,
					point.y,
					(segment.x * 160) / 60,
					(segment.y * 160) / 60,
					obstacles,
				);
			}
		}
		return point;
	}

	it("stops before scenery and slides along it diagonally", () => {
		expect(moveAroundObstacles(80, 150, 30, 0, [wall])).toEqual({
			x: 88,
			y: 150,
		});
		expect(moveAroundObstacles(80, 150, 30, 30, [wall])).toEqual({
			x: 88,
			y: 180,
		});
		expect(moveAroundObstacles(150, 80, 0, 30, [wall])).toEqual({
			x: 150,
			y: 88,
		});
	});

	it("updates walking collision when the well is carried and placed elsewhere", () => {
		const atWell = (box: WalkObstacle) => box.left <= 200 && box.right >= 200 &&
			box.top <= 370 && box.bottom >= 370;
		expect(farmWalkObstacles.some(atWell)).toBe(true);
		try {
			setFarmPropObstacles(placedFarmProps([
				{ index: 2, asset: "well", x: 0, y: 0, carried: true },
			]));
			expect(farmWalkObstacles.some(atWell)).toBe(false);
			setFarmPropObstacles(placedFarmProps([
				{ index: 2, asset: "well", x: 480, y: 416, carried: false },
			]));
			expect(farmWalkObstacles.some((box) => box.left <= 480 && box.right >= 480 &&
				box.top <= 390 && box.bottom >= 390)).toBe(true);
		} finally {
			setFarmPropObstacles(props);
		}
	});

	it("leaves scene spawns clear and train prompts reachable", () => {
		for (const [point, obstacles] of [
			[FARM_PLAYER_SPAWN, farmWalkObstacles],
			[MARKETPLACE_PLAYER_SPAWN, marketplaceWalkObstacles],
			[CASINO_PLAYER_SPAWN, casinoWalkObstacles],
		] as const) {
			expect(obstacles.some((box) => overlaps(point.x, point.y, box))).toBe(
				false,
			);
		}
		expect(
			Math.hypot(
				FARM_PLAYER_SPAWN.x + 160 - FARM_TRAIN_STOP.x,
				FARM_PLAYER_SPAWN.y - FARM_TRAIN_STOP.y,
			),
		).toBeLessThan(115);
		expect(
			Math.hypot(
				MARKETPLACE_PLAYER_SPAWN.x - MARKETPLACE_TRAIN_STOP.x,
				MARKETPLACE_PLAYER_SPAWN.y - MARKETPLACE_TRAIN_STOP.y,
			),
		).toBeLessThan(115);
	});

	it("keeps casino and game prompts within reach of their furniture", () => {
		const casinoApproach = {
			x: MARKETPLACE_CASINO_ENTRANCE.x,
			y: MARKETPLACE_CASINO_ENTRANCE.y + 55,
		};
		expect(
			marketplaceWalkObstacles.some((box) =>
				overlaps(casinoApproach.x, casinoApproach.y, box),
			),
		).toBe(false);
		for (const table of [CASINO_BLACKJACK_TABLE, CASINO_ROULETTE_TABLE]) {
			const approach = { x: table.x, y: table.y - 90 - 12 };
			expect(
				casinoWalkObstacles.some((box) =>
					overlaps(approach.x, approach.y, box),
				),
			).toBe(false);
			expect(
				Math.hypot(approach.x - table.x, approach.y - table.y),
			).toBeLessThan(115);
		}
	});

	it("preserves the existing farm, market, and casino walking route", () => {
		const farm = walk(
			FARM_PLAYER_SPAWN,
			[{ x: 1, y: 0, seconds: 1 }],
			farmWalkObstacles,
		);
		expect(
			Math.hypot(farm.x - FARM_TRAIN_STOP.x, farm.y - FARM_TRAIN_STOP.y),
		).toBeLessThan(115);

		const marketplace = walk(
			MARKETPLACE_PLAYER_SPAWN,
			[
				{ x: Math.SQRT1_2, y: -Math.SQRT1_2, seconds: 2.9 },
				{ x: 1, y: 0, seconds: 1.2 },
			],
			marketplaceWalkObstacles,
		);
		expect(
			Math.hypot(
				marketplace.x - MARKETPLACE_CASINO_ENTRANCE.x,
				marketplace.y - MARKETPLACE_CASINO_ENTRANCE.y,
			),
		).toBeLessThan(105);

		const casino = walk(
			CASINO_PLAYER_SPAWN,
			[{ x: 0, y: 1, seconds: 0.8 }],
			casinoWalkObstacles,
		);
		expect(
			Math.hypot(
				casino.x - CASINO_BLACKJACK_TABLE.x,
				casino.y - CASINO_BLACKJACK_TABLE.y,
			),
		).toBeLessThan(115);
		const roulette = walk(
			CASINO_PLAYER_SPAWN,
			[
				{ x: Math.SQRT1_2, y: Math.SQRT1_2, seconds: 1.8 },
				{ x: 1, y: 0, seconds: 1 },
			],
			casinoWalkObstacles,
		);
		expect(
			Math.hypot(
				roulette.x - CASINO_ROULETTE_TABLE.x,
				roulette.y - CASINO_ROULETTE_TABLE.y,
			),
		).toBeLessThan(145);

		const produce = walk(
			MARKETPLACE_PLAYER_SPAWN,
			[
				{ x: 0, y: -1, seconds: 2 },
				{ x: 1, y: 0, seconds: 1 },
			],
			marketplaceWalkObstacles,
		);
		expect(
			Math.hypot(
				produce.x - MARKETPLACE_PRODUCE_MARKET_ENTRANCE.x,
				produce.y - MARKETPLACE_PRODUCE_MARKET_ENTRANCE.y,
			),
		).toBeLessThan(95);
	});
});
