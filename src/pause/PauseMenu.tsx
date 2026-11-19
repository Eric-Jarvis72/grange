import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { dayPhaseNow } from "../../shared/mechanics";
import { logout } from "../auth";
import { emitSleep } from "../socket";
import { useGameStore } from "../store";
import { usePauseStore } from "./pauseStore";
import "./pause.css";

/**
 * Full-screen pause overlay. Blurs the live world behind a centered panel.
 * Settings and whitelist management are stubbed for now; quitting to desktop
 * signs out and hands the user back to the main menu.
 */
export function PauseMenu() {
	const paused = usePauseStore((s) => s.paused);
	const setPaused = usePauseStore((s) => s.setPaused);
	const username = useGameStore((s) => s.username);
	const worldTime = useGameStore((s) => s.worldTime);
	const activeFarm = useGameStore((s) => s.activeFarm);
	const navigate = useNavigate();
	const [note, setNote] = useState<string | null>(null);
	const [sleepNote, setSleepNote] = useState<string | null>(null);
	const isNight = worldTime ? dayPhaseNow(worldTime) === "night" : false;

	if (!paused) return null;

	function requestSleep() {
		const owner = activeFarm?.owner;
		if (!owner) {
			setSleepNote("Visit a farm to sleep.");
			return;
		}
		setSleepNote(null);
		emitSleep(owner, (res) => {
			if (!res.ok) {
				setSleepNote(res.error ?? "Could not sleep.");
				return;
			}
			setSleepNote(
				res.result === "skipped"
					? "You slept through the night."
					: "Sleep vote started.",
			);
		});
	}

	// Quitting to the menu keeps the session: the farm closes, the account
	// stays signed in, and the menu's Continue re-enters the world.
	function quitToMenu() {
		setPaused(false);
		navigate("/");
	}

	async function quitToDesktop() {
		try {
			await logout();
		} catch {
			// A failed logout request must not strand the player in the world.
			useGameStore.getState().clearUser();
		}
		navigate("/", {
			replace: true,
			state: { notice: "Signed out. You may now close this tab." },
		});
	}

	return (
		<div
			data-testid="pause-menu"
			role="dialog"
			aria-modal="true"
			aria-label="Paused"
			className="pause-backdrop"
		>
			<div className="pause-panel">
				<h2 className="pause-title">Paused</h2>
				{username && (
					<p className="pause-user" data-testid="farm-map-user">
						Signed in as <span className="pause-user-name">{username}</span>
					</p>
				)}

				<nav className="pause-actions">
					<button
						type="button"
						data-testid="pause-resume"
						className="pause-button pause-button-primary"
						onClick={() => setPaused(false)}
					>
						Resume Game
					</button>
					<button
						type="button"
						data-testid="pause-settings"
						className="pause-button"
						onClick={() => setNote("Settings are coming soon.")}
					>
						Settings
					</button>
					<button
						type="button"
						data-testid="pause-whitelist"
						className="pause-button"
						onClick={() => setNote("Whitelist management is coming soon.")}
					>
						Whitelist Management
					</button>
					<button
						type="button"
						data-testid="pause-sleep"
						className="pause-button"
						disabled={!isNight}
						onClick={requestSleep}
					>
						{isNight ? "Sleep Until Morning" : "Sleep (only at night)"}
					</button>
					<button
						type="button"
						data-testid="pause-quit-menu"
						className="pause-button"
						onClick={quitToMenu}
					>
						Quit to Main Menu
					</button>
					<button
						type="button"
						data-testid="logout"
						className="pause-button pause-button-danger"
						onClick={quitToDesktop}
					>
						Quit to Desktop
					</button>
				</nav>

				{note && (
					<p className="pause-note" data-testid="pause-note">
						{note}
					</p>
				)}
				{sleepNote && (
					<p className="pause-note" data-testid="pause-sleep-note">
						{sleepNote}
					</p>
				)}
				<p className="pause-hint">[Esc] Resume</p>
			</div>
		</div>
	);
}
