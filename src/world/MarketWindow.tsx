import { useEffect, useState } from "react";
import { Hotbar } from "../inventory/Hotbar";
import type { MarketDefinition, MarketId, MarketItemId } from "./marketData";
import { ProduceStall } from "./ProduceStall";
import { SeedStall } from "./SeedStall";
import { useEconomyBalance } from "./useEconomy";
import "./marketWindow.css";

/** What a stall needs to draw and drive one tradeable item card. */
export interface MarketItemControl {
	owned: number;
	disabled: boolean;
	actionLabel: string;
	/** When set, the card shows a quantity control capped at this value. */
	maxQuantity?: number;
	onAction: (quantity: number) => void;
}

interface MarketWindowProps {
	market: MarketDefinition;
	controls: Record<MarketItemId, MarketItemControl>;
	message: string | null;
	onClose: () => void;
}

const STALL_TITLES: Record<MarketId, string> = {
	seed: "GRANGE MARKET - SEED STALL",
	produce: "GRANGE MARKET - PRODUCE STALL",
};

/**
 * The pixel-art Grange Market modal. Two stalls share one frame: the Seed Stall
 * buys seeds (with the player's inventory beside it) and the Produce Stall sells
 * barn crops. `Escape` closes, `Tab` switches stalls, and the numeric hotbar
 * stays docked at the bottom.
 */
export function MarketWindow({
	market,
	controls,
	message,
	onClose,
}: MarketWindowProps) {
	const [stall, setStall] = useState<MarketId>(market.id);
	const balance = useEconomyBalance();

	useEffect(() => {
		function onKeyDown(event: KeyboardEvent) {
			if (event.repeat) return;
			if (event.code === "Escape" || event.code === "KeyE") {
				event.preventDefault();
				event.stopImmediatePropagation();
				onClose();
				return;
			}
			if (event.code === "Tab") {
				event.preventDefault();
				event.stopImmediatePropagation();
				setStall((current) => (current === "seed" ? "produce" : "seed"));
			}
		}
		window.addEventListener("keydown", onKeyDown, true);
		return () => window.removeEventListener("keydown", onKeyDown, true);
	}, [onClose]);

	return (
		<div className="market-overlay">
			<div
				className="market-window"
				role="dialog"
				aria-modal="true"
				aria-label={STALL_TITLES[stall]}
				data-testid="market-window"
			>
				<header className="market-header">
					<h2 className="market-title" data-testid="market-title">
						{STALL_TITLES[stall]}
					</h2>
					<div className="market-stall-tabs" role="tablist" aria-label="Stalls">
						<button
							type="button"
							role="tab"
							aria-selected={stall === "seed"}
							className={`market-stall-tab${stall === "seed" ? " market-stall-tab-active" : ""}`}
							data-testid="market-stall-seed"
							onClick={() => setStall("seed")}
						>
							Seed Stall (Buy)
						</button>
						<button
							type="button"
							role="tab"
							aria-selected={stall === "produce"}
							className={`market-stall-tab${stall === "produce" ? " market-stall-tab-active" : ""}`}
							data-testid="market-stall-produce"
							onClick={() => setStall("produce")}
						>
							Produce Stall (Sell)
						</button>
					</div>
					<span className="market-balance" data-testid="farm-balance">
						<span className="market-coin" aria-hidden="true">
							🪙
						</span>
						BALANCE: {balance.toLocaleString()} GC
					</span>
					<button
						type="button"
						className="market-close"
						data-testid="market-close"
						aria-label="Close market"
						onClick={onClose}
					>
						×
					</button>
				</header>

				<div className="market-body">
					{stall === "seed" ? (
						<SeedStall controls={controls} balance={balance} />
					) : (
						<ProduceStall controls={controls} />
					)}
				</div>

				{message && (
					<p className="market-message" data-testid="market-message">
						{message}
					</p>
				)}

				<footer className="market-footer">
					<span className="market-keyhint">[ESC] Close</span>
					<div className="market-footer-hotbar">
						<Hotbar />
					</div>
					<span className="market-keyhint">[TAB] Switch</span>
				</footer>
			</div>
		</div>
	);
}
