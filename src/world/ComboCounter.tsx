import { useEffect, useState } from "react";
import { COMBO_DISPLAY_MIN } from "../../shared/mechanics";
import { useComboStore } from "./comboStore";

/**
 * Minimal floating combo readout. Appears once the chain is worth showing and
 * fades as the window lapses; hides itself entirely when the combo expires.
 */
export function ComboCounter() {
	const count = useComboStore((s) => s.count);
	const expiresAt = useComboStore((s) => s.expiresAt);
	const [now, setNow] = useState(() => Date.now());

	useEffect(() => {
		if (count < COMBO_DISPLAY_MIN) return;
		const id = window.setInterval(() => setNow(Date.now()), 100);
		return () => window.clearInterval(id);
	}, [count]);

	const visible = count >= COMBO_DISPLAY_MIN && now < expiresAt;
	if (!visible) return null;
	const fading = expiresAt - now < 450;

	return (
		<div
			className={`farm-combo${fading ? " farm-combo-fade" : ""}`}
			data-testid="farm-combo"
			aria-live="polite"
		>
			{count}x
		</div>
	);
}
