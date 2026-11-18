import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { resetPassword } from "../auth";

const inputClass =
	"rounded border border-leaf/40 bg-barn-deep px-3 py-2 text-cream outline-none transition focus:border-leaf focus:ember-border text-leaf";
const labelClass = "flex flex-col gap-1 text-sm text-cream";

/** Completes a password reset with the token from the emailed link. */
export default function ResetPassword() {
	const [params] = useSearchParams();
	const token = params.get("token") ?? "";
	const [password, setPassword] = useState("");
	const [status, setStatus] = useState("");
	const [busy, setBusy] = useState(false);

	async function submit(e: React.FormEvent) {
		e.preventDefault();
		if (busy) return;
		setBusy(true);
		setStatus("");
		try {
			const res = await resetPassword(token, password);
			setStatus(
				res.ok
					? "Password updated. You can sign in now."
					: (res.error ?? "Could not reset the password."),
			);
		} catch {
			setStatus("Could not reach the server");
		} finally {
			setBusy(false);
		}
	}

	return (
		<div className="flex min-h-screen flex-col items-center justify-center gap-4 p-4">
			<Link
				to="/login"
				className="text-xs tracking-widest text-husk underline-offset-2 hover:text-leaf hover:underline"
			>
				Back to sign in
			</Link>
			<div className="w-full max-w-sm rounded-lg border border-plum/40 bg-barn p-8 ember-glow text-plum">
				<h1 className="mb-4 text-center text-2xl text-barn-red ember-text">
					Choose a New Password
				</h1>
				<form onSubmit={submit} className="flex flex-col gap-4">
					<label className={labelClass}>
						New password
						<input
							data-testid="reset-password"
							type="password"
							autoComplete="new-password"
							value={password}
							onChange={(e) => setPassword(e.target.value)}
							className={inputClass}
						/>
					</label>
					<button
						type="submit"
						data-testid="reset-submit"
						disabled={busy}
						className="rounded border border-barn-red/60 bg-barn-red/10 px-4 py-2 font-display text-sm font-bold uppercase tracking-wider text-barn-red transition hover:bg-barn-red/20 ember-glow disabled:opacity-50"
					>
						Update password
					</button>
				</form>
				{status && (
					<p data-testid="reset-status" className="mt-4 text-center text-sm text-leaf">
						{status}
					</p>
				)}
			</div>
		</div>
	);
}
