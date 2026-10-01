import { createHash, randomBytes } from "node:crypto";
import type { Session, User } from "../../shared/auth";
import type { UserStore } from "./store";

export const COOKIE_NAME = "grange.sid";
const TOKEN_BYTES = 32;
const DEFAULT_TTL_DAYS = 30;

/** Only the hash of the token is persisted, so a stolen DB cannot be replayed. */
export function hashToken(token: string): string {
	return createHash("sha256").update(token).digest("hex");
}

function ttlMs(): number {
	const days = Number(process.env.SESSION_TTL_DAYS) || DEFAULT_TTL_DAYS;
	return days * 24 * 60 * 60 * 1000;
}

function isExpired(session: Session): boolean {
	return new Date(session.expiresAt).getTime() <= Date.now();
}

/** Issues a new opaque session for the user and returns the raw token to set as a cookie. */
export async function createSessionFor(
	store: UserStore,
	userId: string,
): Promise<{ session: Session; token: string }> {
	const token = randomBytes(TOKEN_BYTES).toString("base64url");
	const now = Date.now();
	const session: Session = {
		id: crypto.randomUUID(),
		userId,
		tokenHash: hashToken(token),
		expiresAt: new Date(now + ttlMs()).toISOString(),
		createdAt: new Date(now).toISOString(),
	};
	await store.createSession(session);
	return { session, token };
}

/** Resolves a raw cookie token to a live user, or null if missing/expired. Expired rows are reaped. */
export async function resolveSession(
	store: UserStore,
	token: string | undefined,
): Promise<User | null> {
	if (!token) return null;
	const session = await store.findSessionByTokenHash(hashToken(token));
	if (!session) return null;
	if (isExpired(session)) {
		await store.deleteSessionByTokenHash(session.tokenHash);
		return null;
	}
	return store.findUserById(session.userId);
}

export async function destroySession(
	store: UserStore,
	token: string | undefined,
): Promise<void> {
	if (!token) return;
	await store.deleteSessionByTokenHash(hashToken(token));
}

/** Minimal cookie-header reader, so the server needs no cookie-parser dependency. */
export function readCookie(
	header: string | undefined,
	name: string,
): string | undefined {
	if (!header) return undefined;
	for (const part of header.split(";")) {
		const eq = part.indexOf("=");
		if (eq === -1) continue;
		if (part.slice(0, eq).trim() !== name) continue;
		try {
			return decodeURIComponent(part.slice(eq + 1).trim());
		} catch {
			return undefined;
		}
	}
	return undefined;
}
