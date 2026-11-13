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
	// CPU and makes every walk slower than it would be with two. CI keeps the
	// same two workers; raise E2E_WORKERS on a machine with real headroom.
	workers: Number(process.env.E2E_WORKERS ?? 2),
	// Generous per-test budget: scene changes animate in game time, so a loaded
	// runner needs more than the default 30s on the longest trips.
	timeout: 90_000,
	// A single retry absorbs the occasional slow-runner walk timeout that has
	// nothing to do with the change under test.
	retries: process.env.CI ? 1 : 0,
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
		env: {
			PORT,
			MIX_ENV: "dev",
			// dev.exs turns these into `:grow_ms` and the farm tick interval.
			// Crops ripen in 100ms and the ticker sweeps every 100ms, so a spec
			// never waits on the 1s production tick. The meta tag the shell
			// injects in dev also enables the SPA's `?area=` boot and 3x walk
			// speed.
			GRANGE_GROW_MS: process.env.GRANGE_GROW_MS ?? "100",
			GRANGE_TICK_MS: process.env.GRANGE_TICK_MS ?? "100",
			// Argon2 is deliberately slow in dev; e2e registers ~50 accounts.
			GRANGE_FAST_HASH: "1",
			// The mailbox route the e2e specs read verification/reset links from
			// only exists under the console mailer; pin it even when `.env` sets
			// real Mailtrap credentials for local development.
			GRANGE_MAILER: "console",
		},
	},
});
