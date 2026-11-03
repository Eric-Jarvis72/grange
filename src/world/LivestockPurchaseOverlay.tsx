import { useEffect } from "react";
import { useEconomyBalance } from "./useEconomy";
import type { LivestockPen } from "./livestockData";
import "./livestock.css";

interface Props {
	pen: LivestockPen;
	owned: number;
	isOwner: boolean;
	busy: boolean;
	message: string | null;
	onBuy: () => void;
	onClose: () => void;
}

export function LivestockPurchaseOverlay({
	pen, owned, isOwner, busy, message, onBuy, onClose,
}: Props) {
	const balance = useEconomyBalance();

	useEffect(() => {
		function onKeyDown(event: KeyboardEvent) {
			if (event.repeat || busy) return;
			if (event.code === "Escape" || event.code === "KeyE") {
				event.preventDefault();
				event.stopImmediatePropagation();
				onClose();
			}
		}
		window.addEventListener("keydown", onKeyDown, true);
		return () => window.removeEventListener("keydown", onKeyDown, true);
	}, [busy, onClose]);

	const disabled = busy || !isOwner || balance < pen.price || owned >= 99;
	return (
		<div className="livestock-overlay">
			<div className="livestock-card" role="dialog" aria-modal="true"
				aria-label={`Buy a ${pen.name}`} data-testid="livestock-purchase">
				<button type="button" className="livestock-close" onClick={onClose}
					aria-label="Close livestock purchase" disabled={busy}>×</button>
				<img src={`/assets/farm/animals/${pen.id}/idle-01.webp`}
					alt="" className="livestock-portrait" />
				<h2>{pen.name}</h2>
				<p className="livestock-price">${pen.price}</p>
				<p>Owned: <span data-testid="livestock-owned">{owned}</span> · Wallet: ${balance}</p>
				{!isOwner && <p>Visit your own farm to buy livestock.</p>}
				{message && <p className="livestock-message" role="status">{message}</p>}
				<button type="button" className="livestock-buy" onClick={onBuy}
					disabled={disabled} data-testid="livestock-buy">
					{busy ? "Buying…" : `Buy ${pen.name} · $${pen.price}`}
				</button>
			</div>
		</div>
	);
}
