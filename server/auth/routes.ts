import { Router } from "express";
import type { Response } from "express";
import type { AuthUser, AuthMe } from "../../shared/auth";
import { authenticate, register } from "./users";
import {
	COOKIE_NAME,
	createSessionFor,
	destroySession,
	readCookie,
	resolveSession,
} from "./sessions";
import type { UserStore } from "./store";

const SECURE = process.env.NODE_ENV === "production";

/** Resolves the signed-in user for a request, or undefined. */
export async function currentUser(
	store: UserStore,
	cookieHeader: string | undefined,
): Promise<AuthUser | undefined> {
	const user = await resolveSession(store, readCookie(cookieHeader, COOKIE_NAME));
	if (!user) return undefined;
	return {
		id: user.id,
		username: user.username,
		email: user.email,
		createdAt: user.createdAt,
	};
}

function setSessionCookie(res: Response, token: string): void {
	res.cookie(COOKIE_NAME, token, {
		httpOnly: true,
		sameSite: "lax",
		secure: SECURE,
		path: "/",
		maxAge: 30 * 24 * 60 * 60 * 1000,
	});
}

export function authRouter(store: UserStore): Router {
	const router = Router();

	router.post("/register", async (req, res) => {
		const result = await register(store, req.body ?? {});
		if (!result.ok) {
			res.status(400).json({ ok: false, error: result.error });
			return;
		}
		const { token } = await createSessionFor(store, result.value.id);
		setSessionCookie(res, token);
		res.status(201).json({ ok: true, user: result.value });
	});

	router.post("/login", async (req, res) => {
		const result = await authenticate(store, req.body ?? {});
		if (!result.ok) {
			// 401 on every credential failure, so the client never advances.
			res.status(401).json({ ok: false, error: result.error });
			return;
		}
		const { token } = await createSessionFor(store, result.value.id);
		setSessionCookie(res, token);
		res.json({ ok: true, user: result.value });
	});

	router.post("/logout", async (req, res) => {
		await destroySession(store, readCookie(req.headers.cookie, COOKIE_NAME));
		res.clearCookie(COOKIE_NAME, { path: "/" });
		res.json({ ok: true });
	});

	router.get("/me", async (req, res) => {
		const user = await currentUser(store, req.headers.cookie);
		if (!user) {
			res.status(401).json({ ok: false, error: "not signed in" });
			return;
		}
		const body: AuthMe = { user };
		res.json({ ok: true, ...body });
	});

	return router;
}
