import { useEffect, useState } from "react";
import { fetchMe } from "./auth";

/**
 * Resolves the session once on mount and reports whether the user may pass the
 * main menu. Children render only once the answer is known, so a protected
 * route never flashes its contents before the 401 comes back.
 */
export function useSession(): { ready: boolean; signedIn: boolean } {
	const [ready, setReady] = useState(false);
	const [signedIn, setSignedIn] = useState(false);

	useEffect(() => {
		let live = true;
		fetchMe()
			.then((user) => {
				if (live) setSignedIn(user !== null);
			})
			.catch(() => {
				if (live) setSignedIn(false);
			})
			.finally(() => {
				if (live) setReady(true);
			});
		return () => {
			live = false;
		};
	}, []);

	return { ready, signedIn };
}
