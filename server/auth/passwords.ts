import argon2 from "argon2";
import type { HashOptions } from "argon2";

/**
 * Argon2id parameters. These are the library's own defaults (m=64MiB, t=3, p=4),
 * which is the right trade for real logins. Unit tests drop them so the suite
 * does not pay the cost on every hash.
 */
const DEFAULTS: HashOptions = {
	type: argon2.argon2id,
	memoryCost: 65536,
	timeCost: 3,
	parallelism: 4,
};

const TEST_PARAMS: HashOptions = {
	memoryCost: 8192,
	timeCost: 1,
	parallelism: 1,
};

function params(): HashOptions {
	return process.env.NODE_ENV === "test"
		? { ...DEFAULTS, ...TEST_PARAMS }
		: DEFAULTS;
}

export async function hashPassword(password: string): Promise<string> {
	return argon2.hash(password, params());
}

export async function verifyPassword(
	hash: string,
	password: string,
): Promise<boolean> {
	try {
		// No options needed: argon2 reads timeCost/memoryCost/parallelism out of
		// the encoded hash, so a digest made under different settings still verifies.
		return await argon2.verify(hash, password);
	} catch {
		// A malformed stored hash must read as "wrong password", never throw.
		return false;
	}
}
