#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const isWindows = process.platform === "win32";

// When invoked from a git hook we never want to block the git operation, so
// failures are reported but exit 0.
const hookMode = process.argv.includes("--hook");

const JS_LOCK = "pnpm-lock.yaml";
const JS_STAMP = "node_modules/.cache/grange/js-deps.stamp";
const ELIXIR_LOCK = "backend/mix.lock";
const ELIXIR_STAMP = "backend/_build/grange-deps.stamp";

function exists(relative) {
	return existsSync(join(root, relative));
}

/**
 * Spawns a command. On Windows, tools like pnpm, mix, and corepack are `.cmd`
 * or `.bat` shims that node cannot execute directly, so they are run through
 * cmd.exe the way a terminal would resolve them.
 */
function spawnCommand(command, args, options) {
	if (isWindows) {
		return spawnSync("cmd.exe", ["/c", command, ...args], options);
	}
	return spawnSync(command, args, options);
}

function run(command, args) {
	const result = spawnCommand(command, args, { stdio: "inherit", cwd: root });
	if (result.error?.code === "ENOENT") return false;
	return (result.status ?? 1) === 0;
}

function onPath(command) {
	if (isWindows) {
		// `where` exits non-zero when the command is not on PATH, and unlike
		// running the tool it cannot be masked by a cmd.exe shim.
		const result = spawnSync("where", [command], { stdio: "ignore" });
		return (result.status ?? 1) === 0;
	}
	const result = spawnSync(command, ["--version"], { stdio: "ignore" });
	return result.error?.code !== "ENOENT";
}

/**
 * A cheap fingerprint of the lockfiles. We compare file mtimes so an edit,
 * a pull, or a branch switch that changes a lockfile re-runs the install,
 * while an unchanged checkout is skipped.
 */
function fingerprint(paths) {
	return paths
		.map((path) => `${path} ${exists(path) ? statSync(join(root, path)).mtimeMs : "missing"}`)
		.join("\n");
}

function upToDate(stampPath, paths, dir) {
	if (!exists(stampPath) || !exists(dir)) return false;
	try {
		return readFileSync(join(root, stampPath), "utf8") === fingerprint(paths);
	} catch {
		return false;
	}
}

function stamp(stampPath, paths) {
	const target = join(root, stampPath);
	mkdirSync(dirname(target), { recursive: true });
	writeFileSync(target, fingerprint(paths));
}

function installJsDeps() {
	if (upToDate(JS_STAMP, [JS_LOCK], "node_modules")) {
		console.log("JS dependencies are up to date.");
		return true;
	}

	const manager = onPath("pnpm")
		? ["pnpm"]
		: onPath("corepack")
			? ["corepack", "pnpm"]
			: null;
	if (!manager) {
		console.error("Could not find pnpm. Install it (see https://mise.jdx.dev/) and retry.");
		return false;
	}

	console.log("Installing JS dependencies...");
	if (!run(manager[0], [...manager.slice(1), "install"])) return false;

	stamp(JS_STAMP, [JS_LOCK]);
	return true;
}

function installElixirDeps() {
	if (upToDate(ELIXIR_STAMP, [ELIXIR_LOCK], "backend/deps")) {
		console.log("Elixir dependencies are up to date.");
		return true;
	}

	// run-mix.mjs falls back to `mise x`, and mise installs missing toolchains
	// itself, so only a machine with neither mix nor mise is fatal here.
	if (!onPath("mix") && !onPath("mise")) {
		console.error(
			"Could not find Elixir. Install mise (https://mise.jdx.dev/), " +
				"run `mise install`, and retry.",
		);
		return false;
	}

	console.log("Installing Elixir dependencies...");
	const script = join(root, "scripts", "run-mix.mjs");

	// A freshly installed Elixir has no Hex, and `mix deps.get` would stop to
	// ask whether to install it. `--if-missing` makes this a no-op once Hex is
	// present; if it fails anyway, deps.get reports the real problem.
	if (!run("node", [script, "local.hex", "--force", "--if-missing"])) {
		console.warn("Could not confirm Hex is installed; trying `mix deps.get` anyway.");
	}

	if (!run("node", [script, "deps.get"])) return false;

	stamp(ELIXIR_STAMP, [ELIXIR_LOCK]);
	return true;
}

function installGitHooks() {
	const script = join(root, "scripts", "install-git-hooks.mjs");
	run("node", [script]);
}

const ok = installJsDeps() && installElixirDeps();

// Keep the auto-install hooks present even when the dependency install was a
// no-op (pnpm skips lifecycle scripts when nothing changed).
installGitHooks();

if (ok) {
	console.log("Dependencies are ready.");
	process.exit(0);
}

if (hookMode) {
	console.error("Automatic dependency install did not finish; run `pnpm bootstrap`.");
	process.exit(0);
}

console.error(
	"Setup did not finish. Fix the error above, then run `pnpm dev` (or `pnpm setup`) again.",
);
process.exit(1);
