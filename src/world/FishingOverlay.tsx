import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { countItem, useInventoryStore } from "../inventory/inventoryStore";
import { emitAddItem } from "../socket";
import { useGameStore } from "../store";
import { economy } from "./EconomyManager";
import {
	type FishDef,
	RARITY_LABEL,
	RODS,
	ROD_ORDER,
	STARTER_ROD,
} from "./fishingData";
import {
	applyArrow,
	type ArrowDir,
	comboLuck,
	comboLuckGain,
	COMBO_LENGTH,
	type ComboProgress,
	dirForKey,
	newComboProgress,
	pickRival,
	resolveCatch,
	rodLuck,
	ROUND_MS,
	rollCatch,
} from "./fishingGame";
import { useFishingStore } from "./fishingStore";
import { FishingGear } from "./FishingGear";
import { useEconomyBalance } from "./useEconomy";
import "./fishing.css";

type Phase = "idle" | "round" | "caught";

const ARROW_GLYPH: Record<ArrowDir, string> = {
	up: "↑",
	down: "↓",
	left: "←",
	right: "→",
};

/** Fixed arrow positions, so each box has a stable (non-index) key. */
const SLOTS = Array.from({ length: COMBO_LENGTH }, (_, slot) => slot);

interface FishingOverlayProps {
	onClose: () => void;
}

/**
 * The pond-side mini-game. Cast, then spend ten seconds matching 4-arrow
 * sequences. Every completed combo banks luck — scaled up by the rod — and a
 * miss only rewinds the current sequence, never removing banked luck. When the
 * clock runs out the catch is rolled with base rod luck plus the combo bonus.
 */
export function FishingOverlay({ onClose }: FishingOverlayProps) {
	const username = useGameStore((s) => s.username);
	const players = useGameStore((s) => s.players);
	const equippedId = useFishingStore((s) => s.equippedRod);
	const equipRod = useFishingStore((s) => s.equipRod);
	const grid = useInventoryStore((s) => s.grid);
	const hotbar = useInventoryStore((s) => s.hotbar);
	const addItem = useInventoryStore((s) => s.addItem);
	const balance = useEconomyBalance();

	const [phase, setPhase] = useState<Phase>("idle");
	const [progress, setProgress] = useState<ComboProgress>(() =>
		newComboProgress(),
	);
	const [timeLeftMs, setTimeLeftMs] = useState(ROUND_MS);
	const [feedback, setFeedback] = useState<"hit" | "miss" | null>(null);
	const [message, setMessage] = useState("Cast your line, then match the arrows.");
	const [caught, setCaught] = useState<FishDef | null>(null);

	const timeouts = useRef<number[]>([]);
	const intervals = useRef<number[]>([]);
	const startedAt = useRef(0);
	const progressRef = useRef(progress);
	const rodRef = useRef(equippedId);
	rodRef.current = equippedId;

	const ownedRods = useMemo(
		() => ROD_ORDER.filter((id) => countItem({ grid, hotbar }, id) > 0),
		[grid, hotbar],
	);
	const equippedRod = ownedRods.includes(equippedId)
		? equippedId
		: STARTER_ROD;

	// Hand the player their best rod when the pond opens. Rods bought at the
	// market are restored from the server as inventory items, so without this a
	// reload would leave a fresh master rod sitting unused in the bag.
	const handedBest = useRef(false);
	useEffect(() => {
		if (handedBest.current || ownedRods.length === 0) return;
		handedBest.current = true;
		const best = ownedRods.reduce(
			(bestId, id) => (RODS[id].luck > RODS[bestId].luck ? id : bestId),
			STARTER_ROD,
		);
		if (best !== equippedId) equipRod(best);
	}, [ownedRods, equippedId, equipRod]);

	const luck = rodLuck(equippedRod);
	const rod = RODS[equippedRod];
	const combos = progress.combos;
	const comboBonus = comboLuck(combos, luck);
	const totalLuck = luck + comboBonus;

	const clearTimers = useCallback(() => {
		for (const id of timeouts.current) window.clearTimeout(id);
		for (const id of intervals.current) window.clearInterval(id);
		timeouts.current = [];
		intervals.current = [];
	}, []);

	useEffect(() => clearTimers, [clearTimers]);

	const commitProgress = useCallback((next: ComboProgress) => {
		progressRef.current = next;
		setProgress(next);
	}, []);

	const bank = useMemo(
		() => ({
			deposit: (amount: number) => {
				economy.sell(amount);
			},
			clearDebt: () => economy.clearDebt(),
		}),
		[],
	);

	const finish = useCallback(() => {
		clearTimers();
		const rodId = rodRef.current;
		const base = rodLuck(rodId);
		const banked = progressRef.current.combos;
		const total = base + comboLuck(banked, base);
		const landed = rollCatch(total);
		const rival = pickRival(
			username,
			players.map((player) => player.name),
		);
		const result = resolveCatch(landed, bank, rival);
		const leftover = addItem(landed.id, 1);
		if (leftover === 0) emitAddItem(landed.id, 1);
		setCaught(landed);
		setPhase("caught");
		const stats = `${banked} combo${banked === 1 ? "" : "s"}, luck ${total.toFixed(2)}`;
		setMessage(
			leftover > 0
				? `${result.message} Your inventory is full, so it slipped back into the pond. (${stats})`
				: `${result.message} (${stats})`,
		);
	}, [addItem, bank, clearTimers, players, username]);

	const cast = useCallback(() => {
		clearTimers();
		setCaught(null);
		setFeedback(null);
		commitProgress(newComboProgress());
		setTimeLeftMs(ROUND_MS);
		setPhase("round");
		setMessage("Match the arrow sequence!");
		startedAt.current = Date.now();
		intervals.current.push(
			window.setInterval(() => {
				setTimeLeftMs(Math.max(0, ROUND_MS - (Date.now() - startedAt.current)));
			}, 100),
		);
		timeouts.current.push(window.setTimeout(finish, ROUND_MS));
	}, [clearTimers, commitProgress, finish]);

	const press = useCallback(
		(dir: ArrowDir) => {
			const result = applyArrow(progressRef.current, dir);
			commitProgress(result.progress);
			setFeedback(result.hit ? "hit" : "miss");
			if (result.completed) {
				const gain = comboLuckGain(rodLuck(rodRef.current));
				setMessage(`Combo! +${gain.toFixed(2)} luck.`);
			}
			timeouts.current.push(
				window.setTimeout(() => setFeedback(null), 220),
			);
		},
		[commitProgress],
	);

	useEffect(() => {
		function onKeyDown(event: KeyboardEvent) {
			if (event.repeat) return;
			if (event.code === "Escape" || event.key === "Escape") {
				event.preventDefault();
				event.stopImmediatePropagation();
				clearTimers();
				onClose();
				return;
			}
			if (phase === "round") {
				const dir = dirForKey(event.code);
				if (dir) {
					event.preventDefault();
					press(dir);
				}
				return;
			}
			if (event.code === "Space" || event.code === "Enter") {
				event.preventDefault();
				cast();
			}
		}
		window.addEventListener("keydown", onKeyDown, true);
		return () => window.removeEventListener("keydown", onKeyDown, true);
	}, [cast, clearTimers, onClose, phase, press]);

	const timePct = Math.round((timeLeftMs / ROUND_MS) * 100);
	return (
		<div
			className="fish-overlay"
			data-testid="fishing-overlay"
			data-phase={phase}
		>
			<div className="fish-panel" role="dialog" aria-label="Fishing">
				<header className="fish-header">
					<h2 className="fish-title">Fishing</h2>
					<span className="fish-balance" data-testid="fishing-balance">
						${balance.toLocaleString()}
					</span>
					<span className="fish-luck" data-testid="fishing-luck">
						{rod.name} · Luck {totalLuck.toFixed(2)}
					</span>
					<button
						type="button"
						className="fish-close"
						data-testid="fishing-close"
						onClick={onClose}
					>
						Leave
					</button>
				</header>

				<div
					className={`fish-water fish-water-${phase}`}
					data-testid="fishing-water"
				>
					<img className="fish-rod-icon" src={rod.icon} alt="" />
					<span className="fish-bobber" aria-hidden="true">
						{phase === "round" ? "❗" : "🎣"}
					</span>
					{caught && (
						<span className="fish-catch" data-testid="fishing-catch">
							<span className="fish-catch-emoji">{caught.emoji}</span>
							<span className="fish-catch-name">{caught.name}</span>
							<span className="fish-catch-rarity">
								{RARITY_LABEL[caught.rarity]} · ${caught.value}
							</span>
						</span>
					)}
				</div>

				{phase === "round" && (
					<>
						<div className="fish-timer" data-testid="fishing-timer">
							<div className="fish-timer-fill" style={{ width: `${timePct}%` }} />
						</div>
						<div
							className={
								feedback === "miss"
									? "fish-sequence fish-sequence-miss"
									: "fish-sequence"
							}
							data-testid="fishing-sequence"
						>
							{SLOTS.map((slot) => (
								<span
									key={slot}
									className={
										slot < progress.index
											? "fish-arrow fish-arrow-done"
											: slot === progress.index
												? "fish-arrow fish-arrow-current"
												: "fish-arrow"
									}
								>
									{ARROW_GLYPH[progress.sequence[slot]]}
								</span>
							))}
						</div>
					</>
				)}

				<p className="fish-message" data-testid="fishing-message">
					{message}
				</p>

				<div className="fish-stats" data-testid="fishing-stats">
					<span>Combos: {combos}</span>
					<span>Combo luck: +{comboBonus.toFixed(2)}</span>
					<span>Total luck: {totalLuck.toFixed(2)}</span>
				</div>

				<div className="fish-actions">
					<button
						type="button"
						className="fish-action fish-primary"
						data-testid="fishing-cast"
						disabled={phase === "round"}
						onClick={cast}
					>
						{phase === "round" ? "Fishing…" : "Cast line"}
					</button>
				</div>

				<p className="fish-hint">
					Use arrow keys or WASD to match each 4-arrow sequence. A miss only
					rewinds the current sequence — banked luck is kept.
				</p>

				<FishingGear
					ownedRods={ownedRods}
					equippedRod={equippedRod}
					onEquip={equipRod}
					grid={grid}
					hotbar={hotbar}
				/>
			</div>
		</div>
	);
}
