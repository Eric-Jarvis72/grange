import { request } from "@playwright/test";
import { BASE } from "./helpers";

/**
 * Wipes accounts and farms once per run.
 *
 * Tests register a unique username each time, so per-test `/api/reset` calls
 * only cost a round trip and forced the whole suite to run with one worker.
 * Playwright starts the web server before global setup, so Phoenix is already
 * answering here.
 */
export default async function globalSetup(): Promise<void> {
	const context = await request.newContext({ baseURL: BASE });
	try {
		const response = await context.post("/api/reset");
		if (!response.ok()) {
			throw new Error(
				`POST /api/reset failed with ${response.status()} ${response.statusText()}`,
			);
		}
	} finally {
		await context.dispose();
	}
}
