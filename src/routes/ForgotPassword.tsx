import { useState } from "react";
import { Link } from "react-router-dom";
import { requestPasswordReset } from "../auth";

const inputClass =
	"rounded border border-leaf/40 bg-barn-deep px-3 py-2 text-cream outline-none transition focus:border-leaf focus:ember-border text-leaf";
const labelClass = "flex flex-col gap-1 text-sm text-cream";

/** Starts a password reset. The response is uniform, so it can't probe accounts. */
export default function ForgotPassword() {
	const [email, setEmail] = useState("");
	const [status, setStatus] = useState("");
	const [busy, setBusy] = useState(false);

	async function submit(e: React.FormEvent) {
		e.preventDefault();
		if (busy) return;
		setBusy(true);
		try {
			await requestPasswordReset(email.trim());
			setStatus(
				"If that address is registered, a reset link is on its way.",
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
					Reset Password
				</h1>
				<form onSubmit={submit} className="flex flex-col gap-4">
					<label className={labelClass}>
						Email
						<input
							data-testid="forgot-email"
							type="email"
							autoComplete="email"
							value={email}
							onChange={(e) => setEmail(e.target.value)}
							className={inputClass}
						/>
					</label>
					<button
						type="submit"
						data-testid="forgot-submit"
						disabled={busy}
						className="rounded border border-barn-red/60 bg-barn-red/10 px-4 py-2 font-display text-sm font-bold uppercase tracking-wider text-barn-red transition hover:bg-barn-red/20 ember-glow disabled:opacity-50"
					>
						Send reset link
					</button>
				</form>
				{status && (
					<p data-testid="forgot-status" className="mt-4 text-center text-sm text-leaf">
						{status}
					</p>
				)}
			</div>
		</div>
	);
}
