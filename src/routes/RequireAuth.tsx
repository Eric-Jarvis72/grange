import { useEffect, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useSession } from "../useSession";

/**
 * Route guard. Until the session is resolved it renders nothing, and an
 * unauthenticated visitor is bounced to the main menu, which is what keeps
 * someone with bad credentials from getting past `/`.
 */
export default function RequireAuth({
	children,
}: {
	children: React.ReactNode;
}) {
	const { ready, signedIn } = useSession();
	const location = useLocation();
	const [checked, setChecked] = useState(ready);

	useEffect(() => {
		if (ready) setChecked(true);
	}, [ready]);

	if (!checked) {
		return (
			<div className="flex min-h-screen items-center justify-center text-leaf">
				<p className="font-display text-sm uppercase tracking-widest ember-text">
					Checking session…
				</p>
			</div>
		);
	}

	if (!signedIn) {
		return <Navigate to="/" replace state={{ from: location.pathname }} />;
	}

	return <>{children}</>;
}
