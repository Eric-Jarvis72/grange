import { beforeEach, describe, expect, it, vi } from "vitest";
import { fetchMe } from "./auth";
import { countItem, useInventoryStore } from "./inventory/inventoryStore";
import { useGameStore } from "./store";

vi.mock("./socket", () => ({
	setAuthToken: vi.fn(),
	rebindAuth: vi.fn(),
}));

function deferred() {
	let resolve!: () => void;
	const promise = new Promise<void>((done) => {
		resolve = done;
	});
	return { promise, resolve };
}

const user = {
	id: "user-1",
	username: "Alice",
	email: "alice@example.test",
	createdAt: new Date(0).toISOString(),
	balance: 100,
	is_admin: false,
};

describe("session hydration", () => {
	beforeEach(() => {
		useGameStore.getState().clearUser();
		useInventoryStore.getState().resetInventory();
		vi.unstubAllGlobals();
	});

	it("does not resolve the session until the inventory snapshot is applied", async () => {
		const inventoryGate = deferred();
		vi.stubGlobal(
			"fetch",
			vi.fn(async (input: RequestInfo | URL) => {
				const url = String(input);
				if (url.includes("/api/auth/me")) {
					return {
						ok: true,
						json: async () => ({ user, token: "token" }),
					} as Response;
				}
				if (url.includes("/api/inventory")) {
					await inventoryGate.promise;
					return {
						ok: true,
						json: async () => ({
							balance: 100,
							seeds: { "seed-bag": 7 },
							slots: [
								{ area: "hotbar", slot: 0, item: "hoe", count: 1 },
								{ area: "hotbar", slot: 1, item: "seed-bag", count: 7 },
							],
						}),
					} as Response;
				}
				throw new Error(`unexpected fetch ${url}`);
			}),
		);

		let settled = false;
		const session = fetchMe().then(() => {
			settled = true;
		});

		await Promise.resolve();
		await Promise.resolve();
		expect(settled).toBe(false);
		expect(useInventoryStore.getState().inventoryHydrated).toBe(false);

		inventoryGate.resolve();
		await session;

		expect(settled).toBe(true);
		expect(useInventoryStore.getState().inventoryHydrated).toBe(true);
		expect(useInventoryStore.getState().inventorySynced).toBe(true);
		expect(countItem(useInventoryStore.getState(), "seed-bag")).toBe(7);
	});
});
