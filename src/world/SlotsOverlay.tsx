import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { economy } from "./EconomyManager";
import { MAX_BET, SLOT_BETS, SLOT_SYMBOLS, symbolDef } from "./slots";
import { SlotMachine } from "./slotsGame";
import { SlotsReels } from "./SlotsReels";
import type { Bank, SlotsSnapshot } from "./slotsTypes";
import { e2eMs } from "./testMode";
import "./slots.css";

interface SlotsOverlayProps {
	onClose: () => void;
}

/** Pause after a round before an auto-spin fires, so the result is readable.
 * E2E shortens it so a three-spin assertion does not cost three seconds. */
const AUTO_DELAY_MS = e2eMs(900, 200);

const SPECIAL_SEQUENCE = ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"];

export function SlotsOverlay({ onClose }: SlotsOverlayProps) {
	const bank = useMemo<Bank>(
		() => ({
			getBalance: () => economy.getBalance(),
			withdraw: (amount) => economy.withdrawChips(amount),
			deposit: (amount) => {
				economy.depositChips(amount);
			},
		}),
		[],
	);
	const [machine] = useState(() => new SlotMachine(bank));
	const [snapshot, setSnapshot] = useState<SlotsSnapshot>(() =>
		machine.snapshot(),
	);
	const [autoSpin, setAutoSpin] = useState(false);
	const [spins, setSpins] = useState(0);
	const sequenceProgress = useRef(0);

	const refresh = useCallback(() => setSnapshot(machine.snapshot()), [machine]);

	const betting = snapshot.phase === "betting";
	const spinning = snapshot.phase === "spinning";
	const settled = snapshot.phase === "settled";

	/** Starts a fresh round and spins once, counting the spin. */
	const spinAgain = useCallback(() => {
		machine.newRound();
		if (machine.spin()) setSpins((count) => count + 1);
		setSnapshot(machine.snapshot());
	}, [machine]);

	// While auto-spin is on, keep playing rounds until it is turned off or the
	// balance can no longer cover the bet.
	useEffect(() => {
		if (!autoSpin || snapshot.phase === "spinning") return;
		if (snapshot.bet > snapshot.balance) {
			setAutoSpin(false);
			return;
		}
		const timer = setTimeout(spinAgain, AUTO_DELAY_MS);
		return () => clearTimeout(timer);
	}, [autoSpin, snapshot.phase, snapshot.bet, snapshot.balance, spinAgain]);

	const triggerJackpot = useCallback(() => {
		if (machine.snapshot().phase === "spinning") return;
		machine.newRound();
		machine.rigNextSpin("seven");
		if (machine.spin(true)) setSpins((count) => count + 1);
		setSnapshot(machine.snapshot());
	}, [machine]);

	useEffect(() => {
		const onKey = (event: KeyboardEvent) => {
			if (event.key === "Escape") {
				if (!spinning) onClose();
				return;
			}
			if (event.key === SPECIAL_SEQUENCE[sequenceProgress.current]) {
				sequenceProgress.current += 1;
				if (sequenceProgress.current === SPECIAL_SEQUENCE.length) {
					sequenceProgress.current = 0;
					triggerJackpot();
				}
			} else {
				sequenceProgress.current = event.key === SPECIAL_SEQUENCE[0] ? 1 : 0;
			}
		};
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, [onClose, spinning, triggerJackpot]);

	const chooseBet = (amount: number) => {
		if (!betting) return;
		machine.setBet(amount);
		refresh();
	};

	const spin = () => {
		if (machine.spin()) setSpins((count) => count + 1);
		refresh();
	};

	const toggleAuto = () => {
		if (autoSpin) {
			setAutoSpin(false);
			return;
		}
		if (betting && snapshot.betError !== null) return;
		setAutoSpin(true);
		if (betting) spin();
	};

	const onLanded = useCallback(() => setSnapshot(machine.settle()), [machine]);

	const playAgain = () => {
		machine.newRound();
		refresh();
	};

	const resultLabel = !settled
		? "—"
		: snapshot.winningSymbol
			? `${symbolDef(snapshot.winningSymbol).label} ×3 — paid $${snapshot.payout}`
			: "No win";

	return (
		<div className="sl-overlay" data-testid="slots-overlay" data-phase={snapshot.phase}>
			<div className="sl-panel" role="dialog" aria-label="Slot machine">
				<header className="sl-header">
					<h2 className="sl-title">Slots</h2>
					<span className="sl-balance" data-testid="slots-balance">
						${snapshot.balance.toLocaleString()}
					</span>
					<span
						className={autoSpin ? "sl-spins sl-spins-auto" : "sl-spins"}
						data-testid="slots-spin-count"
						data-spins={spins}
					>
						Spins: {spins}
					</span>
					<span className="sl-bet" data-testid="slots-current-bet">
						Bet: ${snapshot.bet}
					</span>
					<button
						type="button"
						className="sl-close"
						data-testid="slots-close"
						disabled={spinning}
						onClick={onClose}
					>
						Leave
					</button>
				</header>

				<SlotsReels
					phase={snapshot.phase}
					reels={snapshot.reels}
					winningSymbol={snapshot.winningSymbol}
					onLanded={onLanded}
				/>

				<p className="sl-message" data-testid="slots-message">
					{snapshot.message}
				</p>
				<p className="sl-result" data-testid="slots-result">
					{resultLabel}
				</p>

				<div className="sl-bets">
					{SLOT_BETS.map((amount) => (
						<button
							key={amount}
							type="button"
							className={
								amount === snapshot.bet
									? "sl-bet-option sl-bet-active"
									: "sl-bet-option"
							}
							data-testid={`slots-bet-${amount}`}
							aria-pressed={amount === snapshot.bet}
							disabled={!betting || amount > snapshot.balance}
							onClick={() => chooseBet(amount)}
						>
							${amount}
						</button>
					))}
				</div>

				{snapshot.betError && betting && (
					<span className="sl-error" data-testid="slots-error">
						{snapshot.betError}
					</span>
				)}

				<div className="sl-actions">
					<button
						type="button"
						className="sl-action sl-primary"
						data-testid="slots-spin"
						disabled={!betting || snapshot.betError !== null}
						onClick={spin}
					>
						{spinning ? "Spinning…" : `Spin $${snapshot.bet}`}
					</button>
					<button
						type="button"
						className={autoSpin ? "sl-action sl-auto-on" : "sl-action"}
						data-testid="slots-auto"
						aria-pressed={autoSpin}
						disabled={!autoSpin && snapshot.betError !== null}
						onClick={toggleAuto}
					>
						{autoSpin ? "Stop auto" : "Auto spin"}
					</button>
					{settled && (
						<>
							<button
								type="button"
								className="sl-action"
								data-testid="slots-play-again"
								onClick={playAgain}
							>
								Play again
							</button>
							<button
								type="button"
								className="sl-action"
								data-testid="slots-leave"
								onClick={onClose}
							>
								Leave machine
							</button>
						</>
					)}
				</div>

				<details className="sl-paytable" data-testid="slots-paytable">
					<summary>Paytable</summary>
					<ul>
						{SLOT_SYMBOLS.map((symbol) => (
							<li key={symbol.id}>
								<span>
									{symbol.glyph} {symbol.label} ×3
								</span>
								<span>
									${symbol.multiplier} per $1 · up to $
									{(MAX_BET * symbol.multiplier).toLocaleString()}
								</span>
							</li>
						))}
					</ul>
				</details>
			</div>
		</div>
	);
}
