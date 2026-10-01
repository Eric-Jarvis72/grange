import type { AuthUser, User } from "../../shared/auth";
import { hashPassword, verifyPassword } from "./passwords";
import type { UserStore } from "./store";

// Letters, numbers, underscore and dash. The e2e helper's uniqueName() builds
// names like "Alice-123456789", so a dash has to be legal.
const USERNAME_RE = /^[a-zA-Z0-9_-]{3,32}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD = 8;

export type Result<T> = { ok: true; value: T } | { ok: false; error: string };

function validUsername(username: string): boolean {
	return USERNAME_RE.test(username);
}

function validEmail(email: string): boolean {
	return EMAIL_RE.test(email) && email.length <= 254;
}

/** Strips the password hash before anything crosses the wire. */
export function toAuthUser(user: User): AuthUser {
	return {
		id: user.id,
		username: user.username,
		email: user.email,
		createdAt: user.createdAt,
	};
}

export async function register(
	store: UserStore,
	input: { username?: unknown; email?: unknown; password?: unknown },
): Promise<Result<AuthUser>> {
	const username = String(input.username ?? "").trim();
	const email = String(input.email ?? "").trim().toLowerCase();
	const password = String(input.password ?? "");

	if (!validUsername(username)) {
		return {
			ok: false,
			error: "username must be 3-32 characters (letters, numbers, _ or -)",
		};
	}
	if (!validEmail(email)) {
		return { ok: false, error: "a valid email address is required" };
	}
	if (password.length < MIN_PASSWORD) {
		return {
			ok: false,
			error: `password must be at least ${MIN_PASSWORD} characters`,
		};
	}
	if (await store.findUserByUsername(username)) {
		return { ok: false, error: "that username is taken" };
	}
	if (await store.findUserByEmail(email)) {
		return { ok: false, error: "that email is already registered" };
	}

	const user = await store.createUser({
		username,
		email,
		passwordHash: await hashPassword(password),
	});
	return { ok: true, value: toAuthUser(user) };
}

export async function authenticate(
	store: UserStore,
	input: { username?: unknown; password?: unknown },
): Promise<Result<AuthUser>> {
	const username = String(input.username ?? "").trim();
	const password = String(input.password ?? "");
	if (!username || !password) {
		return { ok: false, error: "username and password are required" };
	}

	const user = await store.findUserByUsername(username);
	// Same message and comparable timing whether the user is missing or the
	// password is wrong, so the response cannot be used to enumerate accounts.
	if (!user) {
		await hashPassword(password);
		return { ok: false, error: "invalid username or password" };
	}
	if (!(await verifyPassword(user.passwordHash, password))) {
		return { ok: false, error: "invalid username or password" };
	}
	return { ok: true, value: toAuthUser(user) };
}
