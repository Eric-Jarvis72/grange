import { useEffect } from "react";
import type { NpcQuestStatus } from "../../shared/types";
import { useEconomyBalance } from "./useEconomy";
import {
	NPC_GOAL,
	NPC_NAME,
	type NpcCrop,
	type NpcSeedOffer,
	type NpcSellCard,
	npcDialogue,
	npcSaleMessage,
	npcSeedOffers,
	npcSellCards,
	npcSellLabel,
} from "./npcQuest";
import "./npcWindow.css";

interface NpcTradeWindowProps {
	status: NpcQuestStatus;
	barn: Record<string, number>;
	message: string | null;
	thanks: NpcCrop | null;
	busy: boolean;
	onClose: () => void;
	onAcknowledge: () => void;
	onDismissThanks: () => void;
	onSell: (crop: NpcCrop) => void;
	onBuySeeds: (offer: NpcSeedOffer) => void;
}

/**
 * The farmhand's conversation: a market-style frame holding his dialogue, the
 * current hand-in card, and (once tomatoes are done) the lettuce/wheat seed
 * bundles. Every button emits a channel event and waits for the authoritative
 * reply, so the window never changes state locally beyond the result line.
 */
export function NpcTradeWindow({
	status,
	barn,
	message,
	thanks,
	busy,
	onClose,
	onAcknowledge,
	onDismissThanks,
	onSell,
	onBuySeeds,
}: NpcTradeWindowProps) {
	const balance = useEconomyBalance();
	const cards = npcSellCards(status, barn);
	const seeds = npcSeedOffers(status.stage);
	const intro = status.stage === "intro";
	const thanking = thanks !== null;

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

	return (
		<div className="market-overlay">
			<div
				className="market-window npc-window"
				role="dialog"
				aria-modal="true"
				aria-label={`${NPC_NAME} the farmhand`}
				data-testid="npc-window"
				data-npc-stage={status.stage}
				data-npc-thanks={thanks ?? "none"}
			>
				<header className="market-header">
					<span className="npc-portrait" aria-hidden="true" />
					<h2 className="market-title" data-testid="npc-title">
						{NPC_NAME.toUpperCase()} THE FARMHAND
					</h2>
					<span className="market-balance" data-testid="npc-balance">
						<span className="market-coin" aria-hidden="true">
							🪙
						</span>
						BALANCE: {balance.toLocaleString()} GC
					</span>
					<button
						type="button"
						className="market-close"
						data-testid="npc-close"
						aria-label="Close conversation"
						onClick={onClose}
					>
						×
					</button>
				</header>

				<div className="market-body npc-body">
					<p className="npc-dialogue" data-testid="npc-dialogue">
						{thanking ? npcSaleMessage(thanks) : npcDialogue(status.stage)}
					</p>

					{message && !thanking && (
						<p className="market-message npc-message" data-testid="npc-message">
							{message}
						</p>
					)}

					{thanking ? (
						<div className="npc-actions">
							<button
								type="button"
								className="market-btn npc-continue"
								data-testid="npc-thanks-continue"
								disabled={busy}
								onClick={onDismissThanks}
							>
								Got it
							</button>
						</div>
					) : intro ? (
						<div className="npc-actions">
							<button
								type="button"
								className="market-btn npc-continue"
								data-testid="npc-continue"
								disabled={busy}
								onClick={onAcknowledge}
							>
								What do you need?
							</button>
						</div>
					) : (
						<div className="npc-trade">
							{cards.length > 0 && (
								<section className="npc-panel" aria-label="Hand in crops">
									<h3 className="market-panel-title">HAND IN</h3>
									<div className="npc-card-grid">
										{cards.map((card) => (
											<NpcSellTile
												key={card.crop}
												card={card}
												busy={busy}
												onSell={onSell}
											/>
										))}
									</div>
								</section>
							)}

							{seeds.length > 0 && (
								<section className="npc-panel" aria-label="Seeds for sale">
									<h3 className="market-panel-title">SEEDS FOR SALE</h3>
									<div className="npc-card-grid">
										{seeds.map((offer) => (
											<article
												key={offer.marketItemId}
												className="market-card npc-card"
											>
												<img
													className="market-card-sprite"
													src={offer.sprite}
													alt=""
													draggable={false}
												/>
												<span className="market-card-name">{offer.label}</span>
												<span className="market-card-price">
													×{offer.quantity} · {offer.price} GC
												</span>
												<button
													type="button"
													className="market-btn"
													data-testid={`npc-buy-${offer.crop}`}
													disabled={busy || balance < offer.price}
													onClick={() => onBuySeeds(offer)}
												>
													Buy {offer.quantity}
												</button>
											</article>
										))}
									</div>
								</section>
							)}

							{status.stage === "complete" && (
								<div className="npc-actions">
									<button
										type="button"
										className="market-btn npc-continue"
										data-testid="npc-done"
										onClick={onClose}
									>
										Farewell
									</button>
								</div>
							)}
						</div>
					)}
				</div>

				<footer className="market-footer">
					<span className="market-keyhint">[ESC] Close</span>
					<span className="market-keyhint">
						{thanking || intro
							? "Dismiss to hear the order"
							: `Batches of ${NPC_GOAL}`}
					</span>
				</footer>
			</div>
		</div>
	);
}

interface NpcSellTileProps {
	card: NpcSellCard;
	busy: boolean;
	onSell: (crop: NpcCrop) => void;
}

/** One hand-in card: its counter, payout, and the batch sell button. */
function NpcSellTile({ card, busy, onSell }: NpcSellTileProps) {
	return (
		<article
			className="market-card npc-card"
			data-testid={`npc-card-${card.crop}`}
		>
			<img
				className="market-card-sprite"
				src={card.sprite}
				alt=""
				draggable={false}
			/>
			<span className="market-card-name">{card.label}</span>
			<span className="market-stock" data-testid={`npc-progress-${card.crop}`}>
				{card.progress} / {NPC_GOAL} handed in
			</span>
			<span className="market-card-price">{card.payout} GC per batch</span>
			<button
				type="button"
				className="market-btn"
				data-testid={`npc-sell-${card.crop}`}
				disabled={busy || !card.ready}
				onClick={() => onSell(card.crop)}
			>
				{npcSellLabel(card)}
			</button>
		</article>
	);
}
