export interface User {
	id: string;
	username: string;
	email: string;
	passwordHash: string;
	createdAt: string;
	balance: number;
	emailVerifiedAt: string | null;
	/** Admins get every item and effectively unlimited money. Dev-only flag. */
	is_admin: boolean;
}

export type AuthUser = Omit<User, "passwordHash">;

export interface NewUser {
	username: string;
	email: string;
	passwordHash: string;
}

export interface Session {
	id: string;
	userId: string;
	tokenHash: string;
	expiresAt: string;
	createdAt: string;
}

export type AuthMe = {
	user: AuthUser;
};
