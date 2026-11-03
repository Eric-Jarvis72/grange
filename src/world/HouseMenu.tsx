import { useEffect, useState } from "react";
import type { ActiveFarm } from "../../shared/types";
import "../pause/pause.css";
import { emitUpdateFarmSettings } from "../socket";
import "./houseMenu.css";

interface HouseMenuProps {
	owner: string;
	farm: ActiveFarm;
	onClose: () => void;
}

/** Owner-only farm settings opened by interacting with the farmhouse. */
export function HouseMenu({ owner, farm, onClose }: HouseMenuProps) {
	const [busy, setBusy] = useState(false);
	const [note, setNote] = useState<string | null>(null);

	useEffect(() => {
		function onKeyDown(event: KeyboardEvent) {
			if (event.repeat) return;
			if (event.code === "Escape" || event.code === "KeyE") {
				event.preventDefault();
				event.stopImmediatePropagation();
				onClose();
			}
		}
		window.addEventListener("keydown", onKeyDown, true);
		return () => window.removeEventListener("keydown", onKeyDown, true);
	}, [onClose]);

	function save(next: { is_public: boolean; visitor_edit: boolean }) {
		if (busy) return;
		setBusy(true);
		setNote(null);
		emitUpdateFarmSettings(owner, next, (result) => {
			setBusy(false);
			if (!result.ok) setNote(result.error ?? "Could not update the farm.");
		});
	}

	function toggleVisibility() {
		save({ is_public: !farm.is_public, visitor_edit: farm.visitor_edit });
	}

	function toggleEditing() {
		save({ is_public: farm.is_public, visitor_edit: !farm.visitor_edit });
	}

	return (
		<div
			data-testid="house-menu"
			role="dialog"
			aria-modal="true"
			aria-label="Farm settings"
			className="pause-backdrop"
		>
			<div className="pause-panel house-panel">
				<h2 className="pause-title">Farmhouse</h2>
				<p className="house-copy">
					Choose who can visit your farm and whether they can help with chores.
				</p>

				<nav className="pause-actions">
					<button
						type="button"
						data-testid="house-visibility-toggle"
						className="pause-button"
						disabled={busy}
						onClick={toggleVisibility}
					>
						Farm visibility: {farm.is_public ? "Public" : "Private"}
					</button>
					<p className="house-detail">
						{farm.is_public
							? "Other players can travel here by train."
							: "Only you can enter. Current visitors stay until they leave."}
					</p>
					<button
						type="button"
						data-testid="house-edit-toggle"
						className="pause-button"
						disabled={busy}
						onClick={toggleEditing}
					>
						Visitor editing: {farm.visitor_edit ? "On" : "Off"}
					</button>
					<p className="house-detail">
						{farm.visitor_edit
							? "Visitors can till, plant, water, harvest, and move fences or props."
							: "Visitors can walk around and use gates, but cannot change the farm."}
					</p>
				</nav>

				{note && <p className="pause-note">{note}</p>}
				{!farm.is_public && farm.visitor_edit && (
					<p className="pause-note">
						Editing applies to visitors who are already here.
					</p>
				)}

				<button
					type="button"
					data-testid="house-close"
					className="pause-button"
					onClick={onClose}
				>
					Close
				</button>
				<p className="pause-hint">[Esc] Close</p>
			</div>
		</div>
	);
}
