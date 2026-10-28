import { useEffect, useState } from "react";
import {
	clampQuantity,
	MARKET_CATEGORIES,
	MARKET_ITEMS,
	type MarketCategoryId,
	type MarketDefinition,
	type MarketItemId,
} from "./marketData";
import "./marketWindow.css";

/** What a category needs to draw one tradeable item card. */
export interface MarketItemControl {
	owned: number;
	disabled: boolean;
	actionLabel: string;
	/** When set, the card shows a quantity stepper capped at this value. */
	maxQuantity?: number;
	onAction: (quantity: number) => void;
}

interface MarketWindowProps {
	market: MarketDefinition;
	controls: Record<MarketItemId, MarketItemControl>;
	message: string | null;
	onClose: () => void;
}

interface QuantityStepperProps {
	id: MarketItemId;
	value: number;
	max: number;
	disabled: boolean;
	onChange: (value: number) => void;
}

function QuantityStepper({
	id,
	value,
	max,
	disabled,
	onChange,
}: QuantityStepperProps) {
	return (
		<div className="market-stepper">
			<button
				type="button"
				className="market-step"
				onClick={() => onChange(value - 1)}
				disabled={disabled || value <= 1}
				aria-label="Decrease quantity"
				data-testid={`market-dec-${id}`}
			>
				−
			</button>
			<input
				type="number"
				className="market-qty"
				min={1}
				max={max}
				value={value}
				disabled={disabled}
				onChange={(event) => onChange(Number(event.target.value))}
				aria-label="Quantity"
				data-testid={`market-qty-${id}`}
			/>
			<button
				type="button"
				className="market-step"
				onClick={() => onChange(value + 1)}
				disabled={disabled || value >= max}
				aria-label="Increase quantity"
				data-testid={`market-inc-${id}`}
			>
				+
			</button>
			<button
				type="button"
				className="market-step market-step-max"
				onClick={() => onChange(max)}
				disabled={disabled}
				data-testid={`market-max-${id}`}
			>
				Max
			</button>
		</div>
	);
}

/**
 * The shop window opened from a market stall. Each category shows its items
 * as cards, with empty squares filling the rest of the grid where future
 * stock will go. Sellable items get a quantity stepper with a Max shortcut.
 */
export function MarketWindow({
	market,
	controls,
	message,
	onClose,
}: MarketWindowProps) {
	const [activeId, setActiveId] = useState<MarketCategoryId>(
		market.defaultCategory,
	);
	const [quantities, setQuantities] = useState<Record<string, number>>({});

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

	function setQuantity(id: MarketItemId, value: number, max: number) {
		setQuantities((prev) => ({ ...prev, [id]: clampQuantity(value, max) }));
	}

	const active = MARKET_CATEGORIES[activeId];
	const emptyCells = Math.max(0, active.slots - active.items.length);
	const slots = Array.from(
		{ length: emptyCells },
		(_, index) => `${active.id}-empty-${index}`,
	);

	return (
		<div className="market-overlay">
			<div
				className="market-window"
				role="dialog"
				aria-modal="true"
				aria-label={market.title}
				data-testid="market-window"
			>
				<header className="market-header">
					<h2 className="market-title" data-testid="market-title">
						{market.title}
					</h2>
					<button
						type="button"
						className="market-close"
						onClick={onClose}
						data-testid="market-close"
						aria-label="Close market"
					>
						×
					</button>
				</header>
				<div
					className="market-tabs"
					role="tablist"
					aria-label="Market categories"
				>
					{market.categories.map((id) => {
						const category = MARKET_CATEGORIES[id];
						const selected = id === activeId;
						return (
							<button
								key={id}
								type="button"
								role="tab"
								aria-selected={selected}
								className={
									selected ? "market-tab market-tab-active" : "market-tab"
								}
								data-testid={`market-tab-${id}`}
								onClick={() => setActiveId(id)}
							>
								{category.label}
							</button>
						);
					})}
				</div>
				<section
					className="market-panel"
					role="tabpanel"
					data-testid="market-panel"
				>
					<p className="market-description">{active.description}</p>
					<div className="market-grid">
						{active.items.map((id) => {
							const item = MARKET_ITEMS[id];
							const control = controls[id];
							const max = control.maxQuantity;
							const quantity = clampQuantity(quantities[id] ?? 1, max ?? 1);
							return (
								<article
									key={id}
									className="market-item"
									data-testid={`market-item-${id}`}
								>
									<span className="market-item-emoji" aria-hidden="true">
										{item.emoji}
									</span>
									<span className="market-item-name">{item.name}</span>
									<span className="market-item-price">{item.blurb}</span>
									<span
										className="market-item-owned"
										data-testid={`market-owned-${id}`}
									>
										Owned: {control.owned}
									</span>
									{max === undefined ? (
										<button
											type="button"
											className="market-item-action"
											data-testid={`market-action-${id}`}
											disabled={control.disabled}
											onClick={() => control.onAction(item.quantity)}
										>
											{control.actionLabel === "Owned"
												? control.actionLabel
												: `${control.actionLabel} · $${item.price.toLocaleString()}`}
										</button>
									) : (
										<>
											<QuantityStepper
												id={id}
												value={quantity}
												max={Math.max(1, max)}
												disabled={control.disabled}
												onChange={(value) => setQuantity(id, value, max)}
											/>
											<button
												type="button"
												className="market-item-action"
												data-testid={`market-action-${id}`}
												disabled={control.disabled}
												onClick={() => control.onAction(quantity)}
											>
												{`${control.actionLabel} ${quantity} for $${
													quantity * item.price
												}`}
											</button>
										</>
									)}
								</article>
							);
						})}
						{slots.map((slotId) => (
							<div
								key={slotId}
								className="market-slot"
								data-testid="market-slot"
								aria-hidden="true"
							/>
						))}
					</div>
					{message && (
						<p className="market-message" data-testid="market-message">
							{message}
						</p>
					)}
				</section>
			</div>
		</div>
	);
}
