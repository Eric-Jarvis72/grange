import { useEffect } from "react";
import "../pause/pause.css";
import "./travelMenu.css";
import { useTravelMenuStore } from "./travelMenuStore";

/** Destination picker shown when the player boards a train. */
export function TravelMenu() {
	const open = useTravelMenuStore((s) => s.open);
	const title = useTravelMenuStore((s) => s.title);
	const options = useTravelMenuStore((s) => s.options);
	const closeMenu = useTravelMenuStore((s) => s.closeMenu);
	const cancelMenu = useTravelMenuStore((s) => s.cancelMenu);

	useEffect(() => {
		if (!open) return;
		function onKeyDown(event: KeyboardEvent) {
			if (event.repeat) return;
			if (event.code === "Escape" || event.code === "KeyE") {
				event.preventDefault();
				event.stopImmediatePropagation();
				cancelMenu();
			}
		}
		window.addEventListener("keydown", onKeyDown, true);
		return () => window.removeEventListener("keydown", onKeyDown, true);
	}, [open, cancelMenu]);

	if (!open) return null;

	function choose(option: (typeof options)[number]) {
		closeMenu();
		option.onSelect();
	}

	return (
		<div
			data-testid="travel-menu"
			role="dialog"
			aria-modal="true"
			aria-label="Choose a train destination"
			className="pause-backdrop"
		>
			<div className="pause-panel travel-panel">
				<h2 className="pause-title">{title}</h2>
				<nav className="pause-actions">
					{options.length === 0 && (
						<p className="travel-empty">No farms are open right now.</p>
					)}
					{options.map((option) => (
						<button
							key={option.id}
							type="button"
							data-testid={`travel-option-${option.id}`}
							className="pause-button travel-option"
							onClick={() => choose(option)}
						>
							<span className="travel-option-label">{option.label}</span>
							{option.detail && (
								<span className="travel-option-detail">{option.detail}</span>
							)}
						</button>
					))}
				</nav>
				<button
					type="button"
					data-testid="travel-cancel"
					className="pause-button"
					onClick={cancelMenu}
				>
					Stay Here
				</button>
				<p className="pause-hint">[Esc] Cancel</p>
			</div>
		</div>
	);
}
