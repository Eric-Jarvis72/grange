import { useState } from "react";
import type { MarketItemControl } from "./MarketWindow";
import type { ProduceStallEntry, SeedStallEntry } from "./marketCatalog";
import {
	MARKET_CATEGORIES,
	MARKET_ITEMS,
	type MarketCategoryId,
	type MarketItemId,
} from "./marketData";

interface SeedCardProps {
	entry: SeedStallEntry;
	control: MarketItemControl;
}

/** A parchment buy card for one seed in the Seed Stall. */
export function SeedCard({ entry, control }: SeedCardProps) {
	const max = Math.max(1, control.maxQuantity ?? 1);
	const [quantity, setQuantity] = useState(1);
	const current = Math.min(quantity, max);

	return (
		<article
			className="market-card market-seed-card"
			data-testid={`market-item-${entry.marketItemId}`}
		>
			<img
				className="market-card-sprite"
				src={entry.sprite}
				alt=""
				draggable={false}
			/>
			<span className="market-card-name">{entry.name}</span>
			<span
				className="market-card-price"
				data-testid={`market-price-${entry.marketItemId}`}
			>
				{entry.price} GC
			</span>
			<span
				className="market-card-owned"
				data-testid={`market-owned-${entry.marketItemId}`}
			>
				Owned: {control.owned}
			</span>
			<div className="market-seed-actions">
				<button
					type="button"
					className="market-btn market-btn-buy"
					data-testid={`market-buy-${entry.marketItemId}`}
					disabled={control.disabled}
					onClick={() => control.onAction(1)}
				>
					BUY
				</button>
				<div className="market-seed-stepper">
					<button
						type="button"
						data-testid={`market-max-${entry.marketItemId}`}
						disabled={control.disabled}
						onClick={() => setQuantity(max)}
					>
						MAX
					</button>
					<button
						type="button"
						data-testid={`market-dec-${entry.marketItemId}`}
						disabled={control.disabled || current <= 1}
						onClick={() => setQuantity((value) => Math.max(1, value - 1))}
					>
						−
					</button>
					<span
						className="market-qty"
						data-testid={`market-qty-${entry.marketItemId}`}
					>
						×{current}
					</span>
					<button
						type="button"
						data-testid={`market-inc-${entry.marketItemId}`}
						disabled={control.disabled || current >= max}
						onClick={() => setQuantity((value) => Math.min(max, value + 1))}
					>
						+
					</button>
				</div>
				<button
					type="button"
					className="market-btn market-btn-buy"
					data-testid={`market-action-${entry.marketItemId}`}
					disabled={control.disabled}
					onClick={() => control.onAction(current)}
				>
					Buy {current} for ${entry.price * current}
				</button>
			</div>
		</article>
	);
}

interface ProduceCardProps {
	entry: ProduceStallEntry;
	control: MarketItemControl;
}

/** A sell card for one barn crop, with a distinct border for rare variants. */
export function ProduceCard({ entry, control }: ProduceCardProps) {
	const stock = control.owned;
	const empty = control.disabled || stock < 1;
	const accent = entry.accent ? ` market-produce-${entry.accent}` : "";
	return (
		<article
			className={`market-card market-produce-card${entry.rare ? " market-produce-rare" : ""}${accent}`}
			data-testid={`market-item-${entry.marketItemId}`}
		>
			<img
				className="market-card-sprite market-produce-sprite"
				src={entry.sprite}
				alt=""
				draggable={false}
			/>
			<div className="market-produce-info">
				<span className="market-card-name">{entry.name}</span>
				<span className="market-card-price">{entry.price} GC</span>
				<span
					className="market-stock"
					data-testid={`market-stock-${entry.marketItemId}`}
				>
					STOCK: {stock}
				</span>
			</div>
			<div className="market-produce-actions">
				<button
					type="button"
					className="market-btn market-btn-sell"
					data-testid={`market-sell-${entry.marketItemId}`}
					disabled={empty}
					onClick={() => control.onAction(1)}
				>
					SELL 1
				</button>
				<button
					type="button"
					className="market-btn market-btn-sellall"
					data-testid={`market-sellall-${entry.marketItemId}`}
					disabled={empty}
					onClick={() => control.onAction(stock)}
				>
					SELL ALL
				</button>
			</div>
		</article>
	);
}

interface GenericCategoryGridProps {
	categoryId: MarketCategoryId;
	controls: Record<MarketItemId, MarketItemControl>;
}

/**
 * The simple grid used by the produce stall's secondary tabs (fish, rods,
 * tools, train) until each gets its own dedicated shop.
 */
export function GenericCategoryGrid({
	categoryId,
	controls,
}: GenericCategoryGridProps) {
	const category = MARKET_CATEGORIES[categoryId];
	const emptyCells = Math.max(0, category.slots - category.items.length);
	const slots = Array.from(
		{ length: emptyCells },
		(_, index) => `${categoryId}-empty-${index}`,
	);
	return (
		<>
			<p className="market-description">{category.description}</p>
			<div className="market-generic-grid">
				{category.items.map((id) => {
					const item = MARKET_ITEMS[id];
					const control = controls[id];
					const quantity = control.maxQuantity ?? item.quantity;
					return (
						<article
							key={id}
							className="market-generic-card"
							data-testid={`market-item-${id}`}
						>
							<span className="market-generic-emoji" aria-hidden="true">
								{item.emoji}
							</span>
							<span className="market-card-name">{item.name}</span>
							<span className="market-card-price">{item.blurb}</span>
							<span className="market-stock">Owned: {control.owned}</span>
							<button
								type="button"
								className="market-btn market-btn-buy"
								data-testid={`market-action-${id}`}
								disabled={control.disabled}
								onClick={() => control.onAction(quantity)}
							>
								{control.actionLabel}
							</button>
						</article>
					);
				})}
				{slots.map((slotId) => (
					<div
						key={slotId}
						className="market-generic-empty"
						data-testid="market-slot"
						aria-hidden="true"
					/>
				))}
			</div>
		</>
	);
}
