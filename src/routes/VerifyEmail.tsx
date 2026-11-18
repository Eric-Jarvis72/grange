import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { verifyEmail } from "../auth";

/**
 * Lands here from the emailed verification link. A successful verify starts a
 * session, so the user is sent to the main menu signed in.
 */
export default function VerifyEmail() {
	const [params] = useSearchParams();
	const token = params.get("token") ?? "";
	const [status, setStatus] = useState("Verifying your email…");
	const navigate = useNavigate();

	useEffect(() => {
		if (!token) {
			setStatus("This verification link is invalid or expired.");
			return;
		}

		let live = true;
		verifyEmail(token).then((res) => {
			if (!live) return;
			if (res.ok) {
				navigate("/", { replace: true });
			} else {
				setStatus(res.error ?? "This verification link is invalid or expired.");
			}
		});
		return () => {
			live = false;
		};
	}, [token, navigate]);

	return (
		<div className="flex min-h-screen flex-col items-center justify-center gap-4 p-4">
			<Link
				to="/"
				className="text-xs tracking-widest text-husk underline-offset-2 hover:text-leaf hover:underline"
			>
				Back to main menu
			</Link>
			<div className="w-full max-w-sm rounded-lg border border-plum/40 bg-barn p-8 ember-glow text-plum">
				<h1 className="mb-4 text-center text-2xl text-barn-red ember-text">
					Verify Email
				</h1>
				<p data-testid="verify-status" className="text-center text-sm text-cream">
					{status}
				</p>
			</div>
		</div>
	);
}
