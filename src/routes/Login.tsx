import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { login, register } from "../auth";

type Mode = "signin" | "signup";

const inputClass =
	"rounded border border-leaf/40 bg-barn-deep px-3 py-2 text-cream outline-none transition focus:border-leaf focus:ember-border text-leaf";
const labelClass = "flex flex-col gap-1 text-sm text-cream";

export default function Login() {
	const [mode, setMode] = useState<Mode>("signin");
	const [username, setUsername] = useState("");
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [error, setError] = useState("");
	const [busy, setBusy] = useState(false);
	const navigate = useNavigate();

	function switchMode(next: Mode) {
		setMode(next);
		setError("");
	}

	async function submit(e: React.FormEvent) {
		e.preventDefault();
		if (busy) return;
		setBusy(true);
		setError("");
		try {
			const res =
				mode === "signin"
					? await login({ username: username.trim(), password })
					: await register({
							username: username.trim(),
							email: email.trim(),
							password,
						});
			if (res.ok && res.user) {
				// login()/register() already stored the user and rebound the socket.
				navigate("/world");
				return;
			}
			// Stays on the main menu: nothing navigates without a server-issued session.
			setError(res.error ?? "Something went wrong");
		} catch {
			setError("Could not reach the server");
		} finally {
			setBusy(false);
		}
	}

	return (
		<div className="flex min-h-screen items-center justify-center p-4">
			<div className="w-full max-w-sm rounded-lg border border-plum/40 bg-barn p-8 ember-glow text-plum">
				<h1 className="mb-1 text-center text-3xl text-barn-red ember-text">
					GRANGE
				</h1>
				<p className="mb-6 text-center text-xs tracking-widest text-husk">
					SOW · GROW · HARVEST
				</p>

				<form onSubmit={submit} className="flex flex-col gap-4">
					<label className={labelClass}>
						Username
						<input
							data-testid="username"
							autoComplete="username"
							value={username}
							onChange={(e) => setUsername(e.target.value)}
							className={inputClass}
						/>
					</label>

					{mode === "signup" && (
						<label className={labelClass}>
							Email
							<input
								data-testid="email"
								type="email"
								autoComplete="email"
								value={email}
								onChange={(e) => setEmail(e.target.value)}
								className={inputClass}
							/>
						</label>
					)}

					<label className={labelClass}>
						Password
						<input
							data-testid="password"
							type="password"
							autoComplete={
								mode === "signin" ? "current-password" : "new-password"
							}
							value={password}
							onChange={(e) => setPassword(e.target.value)}
							className={inputClass}
						/>
					</label>

					<button
						type="submit"
						disabled={busy}
						className="rounded border border-barn-red/60 bg-barn-red/10 px-4 py-2 font-display text-sm font-bold uppercase tracking-wider text-barn-red transition hover:bg-barn-red/20 ember-glow disabled:opacity-50"
					>
						{mode === "signin" ? "Sign In" : "Create Account"}
					</button>

					{error && (
						<p data-testid="auth-error" className="text-center text-sm text-pumpkin">
							{error}
						</p>
					)}
				</form>

				<button
					type="button"
					data-testid="toggle-mode"
					onClick={() => switchMode(mode === "signin" ? "signup" : "signin")}
					className="mt-4 w-full text-center text-xs tracking-wider text-husk underline-offset-2 hover:text-leaf hover:underline"
				>
					{mode === "signin"
						? "No account yet? Create one"
						: "Already registered? Sign in"}
				</button>
			</div>
		</div>
	);
}
