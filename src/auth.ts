import type { AuthUser } from "../shared/auth";
import { rebindAuth } from "./socket";
import { useGameStore } from "./store";

export interface AuthResponse {
	ok: boolean;
	error?: string;
	user?: AuthUser;
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

function accept(data: AuthResponse): AuthResponse {
	if (data.ok && data.user) {
		useGameStore.getState().setUser(data.user);
		rebindAuth();
	}
	return data;
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
	useGameStore.getState().clearUser();
	rebindAuth();
}

/** Resolves the session on page load. Returns null when there is no valid session. */
export async function fetchMe(): Promise<AuthUser | null> {
	const res = await fetch("/api/auth/me", { credentials: "same-origin" });
	if (!res.ok) {
		useGameStore.getState().clearUser();
		return null;
	}
	const { user } = (await res.json()) as { user: AuthUser };
	useGameStore.getState().setUser(user);
	return user;
}
