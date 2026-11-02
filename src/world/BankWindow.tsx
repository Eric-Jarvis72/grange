import { useEffect, useState } from "react";
import { useGameStore } from "../store";
import { economy } from "./EconomyManager";
import type { BankDesk } from "./BankScene";
import { LAND_PRICES } from "./mapData";
import { useEconomyBalance } from "./useEconomy";
import "./bank.css";

interface Props { desk: BankDesk; isOwner: boolean; onClose: () => void }

export function BankWindow({ desk, isOwner, onClose }: Props) {
	const wallet = useEconomyBalance();
	const landLevel = useGameStore((state) => state.activeFarm?.land_level ?? 0);
	const [savings, setSavings] = useState(0);
	const [amount, setAmount] = useState("10");
	const [message, setMessage] = useState<string | null>(null);
	const [busy, setBusy] = useState(false);
	const price = LAND_PRICES[landLevel];

	useEffect(() => {
		void fetch("/api/bank/balance", { credentials: "same-origin" })
			.then((response) => response.json())
			.then((data: { ok: boolean; bank_balance?: number }) => {
				if (data.ok && data.bank_balance !== undefined) setSavings(data.bank_balance);
			})
			.catch(() => setMessage("Could not reach the bank."));
	}, []);

	useEffect(() => {
		function onKey(event: KeyboardEvent) {
			if (event.code !== "Escape" || busy) return;
			event.preventDefault();
			event.stopImmediatePropagation();
			onClose();
		}
		window.addEventListener("keydown", onKey, true);
		return () => window.removeEventListener("keydown", onKey, true);
	}, [busy, onClose]);

	async function submit(kind: "deposit" | "withdraw" | "land") {
		if (busy || !isOwner) return;
		const value = Number(amount);
		if (kind !== "land" && (!Number.isSafeInteger(value) || value <= 0)) {
			setMessage("Enter a positive whole amount.");
			return;
		}
		setBusy(true);
		setMessage(null);
		try {
			const response = await fetch(kind === "land" ? "/api/land/buy" : "/api/bank/transfer", {
				method: "POST", credentials: "same-origin",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(kind === "land" ? {} : { direction: kind, amount: value }),
			});
			const result = await response.json() as {
				ok: boolean; error?: string; balance?: number; bank_balance?: number; land_level?: number;
			};
			if (!response.ok || !result.ok || result.balance === undefined) {
				setMessage(result.error ?? "Transaction failed.");
				return;
			}
			economy.setBalance(result.balance);
			if (result.bank_balance !== undefined) setSavings(result.bank_balance);
			if (result.land_level !== undefined) {
				const state = useGameStore.getState();
				if (state.activeFarm) state.setActiveFarm({ ...state.activeFarm,
					land_level: result.land_level });
			}
			setMessage(kind === "land" ? "New farmland unlocked! Return to your farm to use it."
				: kind === "deposit" ? "Deposit complete." : "Withdrawal complete.");
		} catch {
			setMessage("Could not reach the bank.");
		} finally {
			setBusy(false);
		}
	}

	return <div className="bank-overlay"><div className="bank-window" role="dialog" aria-modal="true"
		aria-label={desk === "mayor" ? "Talk to mayor" : "Talk to bank teller"}>
		<button type="button" className="bank-close" onClick={onClose} disabled={busy}>×</button>
		<img src={`/assets/marketplace/bank/${desk}.webp`} alt="" />
		<h2>{desk === "mayor" ? "Mayor · Land Office" : "Bank Teller"}</h2>
		<p>Wallet: ${wallet}{desk === "teller" && ` · Savings: $${savings}`}</p>
		{desk === "teller" ? <>
			<label htmlFor="bank-amount">Amount</label>
			<input id="bank-amount" type="number" min="1" step="1" value={amount}
				onChange={(event) => setAmount(event.target.value)} />
			<div className="bank-actions">
				<button type="button" disabled={busy || !isOwner} onClick={() => void submit("deposit")}>Deposit</button>
				<button type="button" disabled={busy || !isOwner} onClick={() => void submit("withdraw")}>Withdraw</button>
			</div>
		</> : <>
			<p>{price === undefined ? "You own all available parcels." :
				`Next parcel: $${price} · ${landLevel + 1} of ${LAND_PRICES.length}`}</p>
			<p>Each purchase expands the farm by two tiles along its north or side edge.</p>
			<button type="button" disabled={busy || !isOwner || price === undefined || wallet < price}
				onClick={() => void submit("land")}>Buy land</button>
		</>}
		{!isOwner && <p>Only the farm owner can make transactions.</p>}
		{message && <p role="status">{message}</p>}
	</div></div>;
}
