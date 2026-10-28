export interface TransactionResult {
  success: boolean;
  balance: number;
  error?: string;
}

export class EconomyManager {
  private balance: number;
  private listeners: Set<(balance: number) => void> = new Set();
  private onChange: ((delta: number) => void) | null = null;

  constructor(initialBalance: number = 100) {
    this.balance = initialBalance;
  }

  getBalance(): number {
    return this.balance;
  }

  /**
   * Registers a callback fired with the signed delta after every successful
   * buy/sell, so the balance can be mirrored to the account on the server.
   * `setBalance` never fires it, so loading the authoritative value from the
   * server cannot echo back.
   */
  setOnChange(callback: ((delta: number) => void) | null): void {
    this.onChange = callback;
  }

  /**
   * Overwrites the balance (e.g. with the server's value) and notifies
   * listeners. Unlike `buy`/`sell`, this does not report a delta.
   */
  setBalance(balance: number): void {
    this.balance = balance;
    this.notify();
  }

  /**
   * Subscribe to balance changes (notifies the HUD React component).
   */
  subscribe(callback: (balance: number) => void): () => void {
    this.listeners.add(callback);
    callback(this.balance);
    return () => this.listeners.delete(callback);
  }

  private notify(): void {
    this.listeners.forEach((callback) => {
      callback(this.balance);
    });
  }

  /**
   * Validation logic for buying seeds, tools, or land.
   */
  canAfford(cost: number): boolean {
    return Number.isFinite(cost) && this.balance >= cost;
  }

  /**
   * Rejects amounts that aren't finite, non-negative numbers. Without this,
   * `sell(NaN)` would add NaN to the balance and corrupt every later total.
   */
  private validate(amount: number, label: string): string | null {
    if (!Number.isFinite(amount)) return `${label} must be a finite number`;
    if (amount < 0) return `${label} cannot be negative`;
    return null;
  }

  buy(cost: number): TransactionResult {
    const error = this.validate(cost, "Cost");
    if (error) {
      return { success: false, balance: this.balance, error };
    }
    if (!this.canAfford(cost)) {
      return { success: false, balance: this.balance, error: "Insufficient funds" };
    }

    this.balance -= cost;
    this.notify();
    this.onChange?.(-cost);
    return { success: true, balance: this.balance };
  }

  /**
   * Moves chips from the wallet to a casino table (posting a blind, calling or
   * raising). Kept separate from `buy` so table transfers aren't confused with
   * purchasing goods, though both are mirrored to the account the same way.
   * Returns false when the wallet cannot cover the amount.
   */
  withdrawChips(amount: number): boolean {
    return this.buy(amount).success;
  }

  /** Returns chips from a casino table to the wallet (cashing out a pot). */
  depositChips(amount: number): void {
    this.sell(amount);
  }

  /**
   * Clears a negative balance (a debt) back to zero and returns how much was
   * erased. A non-negative balance is left untouched. Unlike buy/sell this is
   * a windfall, so it reports the positive delta so the account stays in sync.
   */
  clearDebt(): number {
    if (this.balance >= 0) return 0;
    const cleared = -this.balance;
    this.balance = 0;
    this.notify();
    this.onChange?.(cleared);
    return cleared;
  }

  /**
   * Logic for selling harvested crops or goods.
   */
  sell(earnings: number): TransactionResult {
    const error = this.validate(earnings, "Earnings");
    if (error) {
      return { success: false, balance: this.balance, error };
    }

    this.balance += earnings;
    this.notify();
    this.onChange?.(earnings);
    return { success: true, balance: this.balance };
  }
}

// Export a single shared instance across the frontend
export const economy = new EconomyManager(100);