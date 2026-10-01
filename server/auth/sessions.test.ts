import { beforeEach, describe, expect, it } from "vitest";
import {
	COOKIE_NAME,
	createSessionFor,
	destroySession,
	hashToken,
	readCookie,
	resolveSession,
} from "./sessions";
import { InMemoryUserStore } from "./store";

let store: InMemoryUserStore;
let userId: string;

beforeEach(async () => {
	store = new InMemoryUserStore();
	userId = (await store.createUser({
		username: "farmer_jo",
		email: "jo@example.com",
		passwordHash: "$argon2id$fake",
	})).id;
});

describe("readCookie", () => {
	it("finds a named cookie among several and decodes it", () => {
		const header = `other=1; ${COOKIE_NAME}=abc%2Fdef; more=2`;
		expect(readCookie(header, COOKIE_NAME)).toBe("abc/def");
	});

	it("returns undefined for a missing header or missing name", () => {
		expect(readCookie(undefined, COOKIE_NAME)).toBeUndefined();
		expect(readCookie("other=1", COOKIE_NAME)).toBeUndefined();
	});
});

describe("session lifecycle", () => {
	it("stores only the token hash, never the raw token", async () => {
		const { session, token } = await createSessionFor(store, userId);
		expect(session.tokenHash).toBe(hashToken(token));
		expect(session.tokenHash).not.toBe(token);
		expect(await store.findSessionByTokenHash(token)).toBeNull();
	});

	it("resolves a live token to its user", async () => {
		const { token } = await createSessionFor(store, userId);
		const user = await resolveSession(store, token);
		expect(user?.id).toBe(userId);
	});

	it("returns null for a missing or unknown token", async () => {
		expect(await resolveSession(store, undefined)).toBeNull();
		expect(await resolveSession(store, "garbage")).toBeNull();
	});

	it("treats an expired session as absent and reaps it", async () => {
		const { session, token } = await createSessionFor(store, userId);
		session.expiresAt = new Date(Date.now() - 1000).toISOString();
		expect(await resolveSession(store, token)).toBeNull();
		expect(await store.findSessionByTokenHash(session.tokenHash)).toBeNull();
	});

	it("stops resolving after destroy", async () => {
		const { token } = await createSessionFor(store, userId);
		await destroySession(store, token);
		expect(await resolveSession(store, token)).toBeNull();
	});
});
