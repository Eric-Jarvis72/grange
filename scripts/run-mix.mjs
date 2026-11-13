import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const cwd = resolve(root, "backend");
const args = process.argv.slice(2);

function onPath(command) {
	const result = spawnSync(command, ["--version"], { stdio: "ignore" });
	return result.error?.code !== "ENOENT";
}

/**
 * Read the repo-root `.env` so `pnpm dev` sees the variables the
 * `.env.example` template documents (Phoenix does not read `.env` itself).
 * Real environment variables win, so a shell export overrides the file.
 */
function dotEnv() {
	const file = join(root, ".env");
	if (!existsSync(file)) return {};

	const env = {};
	for (const raw of readFileSync(file, "utf8").split(/\r?\n/)) {
		const line = raw.trim();
		if (!line || line.startsWith("#")) continue;
		const eq = line.indexOf("=");
		if (eq < 1) continue;

		const key = line.slice(0, eq).trim().replace(/^export\s+/, "");
		let value = line.slice(eq + 1).trim();
		if (
			(value.startsWith('"') && value.endsWith('"')) ||
			(value.startsWith("'") && value.endsWith("'"))
		) {
			value = value.slice(1, -1);
		}
		env[key] = value;
	}
	return env;
}

/**
 * Visual Studio Build Tools install `cl`/`nmake`, but only expose them via a
 * batch script that also sets INCLUDE/LIB. Native deps (argon2_elixir) need
 * that environment, so capture it once and merge it into the child env.
 */
function msvcEnvironment() {
	if (process.platform !== "win32" || onPath("nmake")) return {};

	const vswhere = join(
		process.env["ProgramFiles(x86)"] ?? "C:\\Program Files (x86)",
		"Microsoft Visual Studio",
		"Installer",
		"vswhere.exe",
	);
	if (!existsSync(vswhere)) return {};

	const found = spawnSync(
		vswhere,
		[
			"-latest",
			"-products",
			"*",
			"-requires",
			"Microsoft.VisualStudio.Component.VC.Tools.x86.x64",
			"-property",
			"installationPath",
		],
		{ encoding: "utf8" },
	);
	const install = found.stdout?.trim();
	if (!install) return {};

	const vcvars = join(install, "VC", "Auxiliary", "Build", "vcvars64.bat");
	if (!existsSync(vcvars)) return {};

	const captured = spawnSync(`call "${vcvars}" >nul && set`, {
		encoding: "utf8",
		shell: true,
	});
	const env = {};
	for (const line of captured.stdout?.split(/\r?\n/) ?? []) {
		const eq = line.indexOf("=");
		if (eq > 0) env[line.slice(0, eq)] = line.slice(eq + 1);
	}
	return env;
}

const env = { ...dotEnv(), ...process.env, ...msvcEnvironment() };

const direct = spawnSync("mix", args, { cwd, stdio: "inherit", env });
if (direct.error?.code !== "ENOENT") {
	process.exit(direct.status ?? 1);
}

const viaMise = spawnSync("mise", ["x", "--", "mix", ...args], {
	cwd,
	stdio: "inherit",
	env,
});
if (viaMise.error?.code === "ENOENT") {
	console.error("Could not find mix or mise. Install Elixir or mise first.");
}
process.exit(viaMise.status ?? 1);
