import { beforeEach, describe, expect, it } from "vitest";
import { InMemoryUserStore } from "./store";
import { authenticate, register } from "./users";

const good = {
	username: "farmer_jo",
	email: "jo@example.com",
	password: "correct-horse",
};

let store: InMemoryUserStore;

beforeEach(() => {
	store = new InMemoryUserStore();
});

describe("register", () => {
	it("creates an account and never returns the password hash", async () => {
		const result = await register(store, good);
		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(result.value.username).toBe("farmer_jo");
		expect("passwordHash" in result.value).toBe(false);

		const stored = await store.findUserByUsername("farmer_jo");
		expect(stored?.passwordHash).toBeTruthy();
		expect(stored?.passwordHash).not.toContain("correct-horse");
	});

	it("lowercases the email so logins are case-insensitive on it", async () => {
		await register(store, { ...good, email: "Jo@Example.COM" });
		expect(await store.findUserByEmail("jo@example.com")).not.toBeNull();
	});

	it("rejects a short password", async () => {
		const result = await register(store, { ...good, password: "short" });
		expect(result.ok).toBe(false);
		if (result.ok) return;
		expect(result.error).toMatch(/at least 8/);
	});

	it("rejects a bad username, missing email, and duplicate username/email", async () => {
		expect((await register(store, { ...good, username: "a" })).ok).toBe(false);
		expect((await register(store, { ...good, email: "nope" })).ok).toBe(false);

		await register(store, good);
		const dupeUser = await register(store, { ...good, email: "other@example.com" });
		const dupeEmail = await register(store, { ...good, username: "farmer_ji" });
		expect(dupeUser.ok).toBe(false);
		expect(dupeEmail.ok).toBe(false);
		if (!dupeUser.ok) expect(dupeUser.error).toMatch(/username is taken/);
		if (!dupeEmail.ok) expect(dupeEmail.error).toMatch(/already registered/);
	});
});

describe("authenticate", () => {
	beforeEach(async () => {
		await register(store, good);
	});

	it("accepts the right password", async () => {
		const result = await authenticate(store, {
			username: "farmer_jo",
			password: "correct-horse",
		});
		expect(result.ok).toBe(true);
	});

	it("rejects a wrong password", async () => {
		const result = await authenticate(store, {
			username: "farmer_jo",
			password: "wrong",
		});
		expect(result.ok).toBe(false);
	});

	it("gives the same error for an unknown user as for a wrong password", async () => {
		const unknown = await authenticate(store, {
			username: "nobody",
			password: "correct-horse",
		});
		const wrong = await authenticate(store, {
			username: "farmer_jo",
			password: "nope",
		});
		expect(unknown.ok).toBe(false);
		expect(wrong.ok).toBe(false);
		if (!unknown.ok && !wrong.ok) {
			expect(unknown.error).toBe(wrong.error);
		}
	});

	it("requires both fields", async () => {
		expect((await authenticate(store, { username: "farmer_jo" })).ok).toBe(false);
		expect((await authenticate(store, { password: "x" })).ok).toBe(false);
	});
});
