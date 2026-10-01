import type { NewUser, Session, User } from "../../shared/auth";

/**
 * Persistence seam for authentication. The in-memory implementation below is
 * the only thing the auth modules know about, so swapping in a real database
 * later means writing one more adapter and changing the import - no caller
 * signatures change.
 */
export interface UserStore {
	createUser(user: NewUser): Promise<User>;
	findUserByUsername(username: string): Promise<User | null>;
	findUserByEmail(email: string): Promise<User | null>;
	findUserById(id: string): Promise<User | null>;
	createSession(session: Session): Promise<void>;
	findSessionByTokenHash(tokenHash: string): Promise<Session | null>;
	deleteSessionByTokenHash(tokenHash: string): Promise<void>;
	deleteAll(): Promise<void>;
}

/** In-memory store. Usable for local dev and tests; not durable across restarts. */
export class InMemoryUserStore implements UserStore {
	private users: User[] = [];
	private sessions: Session[] = [];

	async createUser(user: NewUser): Promise<User> {
		const created: User = {
			...user,
			id: crypto.randomUUID(),
			createdAt: new Date().toISOString(),
		};
		this.users.push(created);
		return created;
	}

	async findUserByUsername(username: string): Promise<User | null> {
		return this.users.find((u) => u.username === username) ?? null;
	}

	async findUserByEmail(email: string): Promise<User | null> {
		return this.users.find((u) => u.email === email) ?? null;
	}

	async findUserById(id: string): Promise<User | null> {
		return this.users.find((u) => u.id === id) ?? null;
	}

	async createSession(session: Session): Promise<void> {
		this.sessions.push(session);
	}

	async findSessionByTokenHash(tokenHash: string): Promise<Session | null> {
		return this.sessions.find((s) => s.tokenHash === tokenHash) ?? null;
	}

	async deleteSessionByTokenHash(tokenHash: string): Promise<void> {
		this.sessions = this.sessions.filter((s) => s.tokenHash !== tokenHash);
	}

	async deleteAll(): Promise<void> {
		this.users = [];
		this.sessions = [];
	}
}
