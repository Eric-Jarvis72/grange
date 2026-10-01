import type { User } from "../../shared/auth";
import { COOKIE_NAME, readCookie, resolveSession } from "./sessions";
import { InMemoryUserStore } from "./store";

export const userStore = new InMemoryUserStore();

/**
 * socket.io handshake guard. Resolves the session cookie into socket.data so
 * game handlers keep using their existing `loggedInName` guard unchanged.
 * Sets both `userId` (the real identity) and `username` (the legacy display
 * name the card-game handlers still read).
 */
export async function resolveSocketSession(
	headers: Record<string, string | string[] | undefined>,
	data: Record<string, unknown>,
): Promise<void> {
	const raw = Array.isArray(headers.cookie)
		? headers.cookie.join("; ")
		: headers.cookie;
	const user: User | null = await resolveSession(
		userStore,
		readCookie(raw, COOKIE_NAME),
	);
	if (!user) return;
	data.userId = user.id;
	data.username = user.username;
}
