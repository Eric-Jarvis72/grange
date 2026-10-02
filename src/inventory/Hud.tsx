import { useNavigate } from "react-router-dom";
import { logout } from "../auth";
import { useGameStore } from "../store";
import { Hotbar } from "./Hotbar";
import { useInventoryStore } from "./inventoryStore";

export function Hud() {
	const username = useGameStore((s) => s.username);
	const toggleInventory = useInventoryStore((s) => s.toggleInventory);
	const navigate = useNavigate();

	async function onSignOut() {
		await logout();
		navigate("/", { replace: true });
	}

	return (
		<div className="hud-root">
			<div className="hud-bottom-center">
				<Hotbar />
			</div>
			<div className="hud-bottom-right">
				<span className="hud-user" data-testid="farm-map-user">
					{username}
				</span>
				<button
					type="button"
					data-testid="open-inventory"
					className="hud-prompt"
					onClick={toggleInventory}
				>
					[I] Inventory
				</button>
				<span className="hud-prompt hud-prompt-static">[Esc] Close</span>
				<button
					type="button"
					data-testid="logout"
					onClick={onSignOut}
					className="hud-signout"
				>
					Sign out
				</button>
			</div>
		</div>
	);
}
