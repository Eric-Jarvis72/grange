import type { AuthUser } from "../shared/auth";
import { useInventoryStore } from "./inventory/inventoryStore";
import { rebindAuth, setAuthToken } from "./socket";
import { useGameStore } from "./store";
import { economy } from "./world/EconomyManager";

export interface AuthResponse {
	ok: boolean;
	error?: string;
	user?: AuthUser;
	token?: string;
}

async function post(
	path: string,
	body: unknown,
): Promise<{ status: number; data: AuthResponse }> {
	const res = await fetch(`/api/auth${path}`, {
		method: "POST",
		credentials: "same-origin",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(body),
	});
	return { status: res.status, data: await res.json() };
}

/**
 * Admin accounts are handed the full catalog after the saved layout is applied.
 * Seed totals still come from the server ledger; the layout is persisted like
 * any other account's.
 */
function applyAdminInventory(user: AuthUser): void {
	if (user.is_admin) useInventoryStore.getState().grantAllItems();
}

async function accept(data: AuthResponse): Promise<AuthResponse> {
	if (data.ok && data.user) {
		useGameStore.getState().setUser(data.user);
		// The account owns the balance; adopt it so a fresh account starts at
		// the opening amount instead of inheriting the previous session's total.
		economy.setBalance(data.user.balance);
		setAuthToken(data.token ?? null);
		rebindAuth();
		invalidateInventoryFetch();
		await fetchInventory();
		applyAdminInventory(data.user);
	}
	return data;
}

let inventoryFetch: Promise<void> | null = null;
let inventoryEpoch = 0;

function invalidateInventoryFetch(): void {
	inventoryEpoch += 1;
	inventoryFetch = null;
}

/**
 * Loads the account's persisted inventory layout and seed ledger. Best-effort:
 * a failed request marks hydration complete so the world can still open, and
 * the server will reject any action the client cannot really afford.
 */
export function fetchInventory(): Promise<void> {
	if (inventoryFetch) return inventoryFetch;

	const epoch = inventoryEpoch;
	let tracked: Promise<void>;
	tracked = fetchInventoryOnce(epoch).finally(() => {
		if (inventoryFetch === tracked) inventoryFetch = null;
	});
	inventoryFetch = tracked;
	return tracked;
}

async function fetchInventoryOnce(epoch: number): Promise<void> {
	try {
		const res = await fetch("/api/inventory", { credentials: "same-origin" });
		if (epoch !== inventoryEpoch) return;
		if (!res.ok) {
			useInventoryStore.getState().markInventoryHydrated();
			return;
		}
		const data = (await res.json()) as {
			seeds?: Record<string, number>;
			slots?: unknown;
			balance?: number;
		};
		if (epoch !== inventoryEpoch) return;
		if (typeof data.balance === "number") economy.setBalance(data.balance);
		if (!Array.isArray(data.slots)) {
			// An older server only knows seed totals; keep them but do not
			// overwrite a layout it cannot persist.
			useInventoryStore.getState().hydrateSeeds(data.seeds ?? {});
			return;
		}
		useInventoryStore.getState().hydrateInventory(data.slots, data.seeds ?? {});
	} catch {
		if (epoch === inventoryEpoch) {
			useInventoryStore.getState().markInventoryHydrated();
		}
	}
}

/**
 * Mirrors a balance change to the signed-in account. Best-effort: local play
 * continues even if the request fails, and it is re-synced on next auth.
 */
export async function saveBalanceDelta(delta: number): Promise<void> {
	if (!Number.isFinite(delta) || delta === 0) return;
	try {
		await fetch("/api/economy/transaction", {
			method: "POST",
			credentials: "same-origin",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ delta }),
		});
	} catch {
		// Ignore: a dropped sync must not break local gameplay.
	}
}

export async function register(input: {
	username: string;
	email: string;
	password: string;
}): Promise<AuthResponse> {
	return accept((await post("/register", input)).data);
}

export async function login(input: {
	username: string;
	password: string;
}): Promise<AuthResponse> {
	return accept((await post("/login", input)).data);
}

export async function logout(): Promise<void> {
	await post("/logout", {});
	invalidateInventoryFetch();
	useGameStore.getState().clearUser();
	// Drop any admin-granted inventory so it cannot leak to the next sign-in.
	useInventoryStore.getState().resetInventory();
	setAuthToken(null);
	rebindAuth();
}

/** Resolves the session on page load. Returns null when there is no valid session. */
export async function fetchMe(): Promise<AuthUser | null> {
	const res = await fetch("/api/auth/me", { credentials: "same-origin" });
	if (!res.ok) {
		useGameStore.getState().clearUser();
		setAuthToken(null);
		return null;
	}
	const { user, token } = (await res.json()) as {
		user: AuthUser;
		token: string;
	};
	useGameStore.getState().setUser(user);
	economy.setBalance(user.balance);
	setAuthToken(token);
	rebindAuth();
	invalidateInventoryFetch();
	await fetchInventory();
	applyAdminInventory(user);
	return user;
}
