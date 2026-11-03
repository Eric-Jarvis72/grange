import { defineConfig } from "@playwright/test";

const PORT = process.env.E2E_PORT ?? "3201";
const BASE_URL = process.env.E2E_BASE_URL ?? `http://localhost:${PORT}`;

export default defineConfig({
	testDir: "e2e",
	// Accounts are wiped once in `globalSetup`; tests register unique usernames
	// so they no longer have to reset the server themselves.
	globalSetup: "./e2e/global-setup.ts",
	fullyParallel: true,
	// Two workers is the sweet spot: the farm scene is canvas-heavy, and a
	// faster local machine started at its own core count just saturates the
	// CPU and makes every walk slower than it would be with two.
	workers: 2,
	// Generous per-test budget: scene changes animate in game time, so a loaded
	// runner needs more than the default 30s on the longest trips.
	timeout: 90_000,
	// The CI workflow uploads `playwright-report/`, so always emit the HTML
	// report (the default list-only reporter never creates it).
	reporter: [["list"], ["html", { open: "never" }]],
	use: {
		baseURL: BASE_URL,
	},
	webServer: {
		// Phoenix serves the built SPA (from backend/priv/static), so e2e
		// exercises the real production request path with no Vite involved.
		command: "node scripts/run-mix.mjs phx.server",
		url: BASE_URL,
		reuseExistingServer: true,
		timeout: 120_000,
		env: { PORT, MIX_ENV: "dev" },
	},
});
