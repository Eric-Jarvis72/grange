import { useEffect } from "react";
import { emitSleepVote } from "../socket";
import { useGameStore } from "../store";
import "./sleepVote.css";

/**
 * Shows the farm's live sleep vote. Everyone present sees the initiator name
 * and can accept/decline with the buttons or the Y/N keys.
 */
export function SleepVoteToast() {
	const vote = useGameStore((s) => s.sleepVote);
	const result = useGameStore((s) => s.sleepResult);
	const owner = useGameStore((s) => s.activeFarm?.owner ?? null);

	useEffect(() => {
		if (!vote || !owner) return;
		const farmOwner = owner;
		function onKey(event: KeyboardEvent) {
			if (event.key === "y" || event.key === "Y")
				emitSleepVote(farmOwner, "accept");
			if (event.key === "n" || event.key === "N")
				emitSleepVote(farmOwner, "decline");
		}
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, [vote, owner]);

	useEffect(() => {
		if (!result) return;
		const timer = window.setTimeout(() => {
			useGameStore.getState().setSleepResult(null);
		}, 4_000);
		return () => window.clearTimeout(timer);
	}, [result]);

	if (result) {
		const text =
			result.result === "accepted" || result.result === "skipped"
				? `${result.initiator} sent everyone to sleep. Good morning!`
				: result.result === "declined"
					? `${result.initiator}'s sleep request was declined.`
					: `${result.initiator}'s sleep request expired.`;

		return (
			<div
				className="sleep-vote-toast sleep-vote-result"
				data-testid="sleep-vote-result"
				role="status"
			>
				{text}
			</div>
		);
	}

	if (!vote) return null;

	return (
		<div
			className="sleep-vote-toast"
			data-testid="sleep-vote-toast"
			role="alert"
		>
			<p className="sleep-vote-text">
				<strong>{vote.initiator}</strong> wants to sleep. [Y] Accept / [N]
				Decline
			</p>
			<div className="sleep-vote-actions">
				<button
					type="button"
					data-testid="sleep-vote-accept"
					onClick={() => owner && emitSleepVote(owner, "accept")}
				>
					Accept
				</button>
				<button
					type="button"
					data-testid="sleep-vote-decline"
					onClick={() => owner && emitSleepVote(owner, "decline")}
				>
					Decline
				</button>
			</div>
		</div>
	);
}
