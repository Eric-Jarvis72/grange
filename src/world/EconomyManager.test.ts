import { describe, expect, it, vi } from "vitest";
import { EconomyManager, economy } from "./EconomyManager";

describe("EconomyManager", () => {
  it("starts with the given balance and defaults to $100", () => {
    expect(new EconomyManager().getBalance()).toBe(100);
    expect(new EconomyManager(250).getBalance()).toBe(250);
  });

  it("exports a shared instance starting at $100", () => {
    expect(economy.getBalance()).toBe(100);
  });

  it("setBalance overwrites and notifies without reporting a delta", () => {
    const manager = new EconomyManager(100);
    const onChange = vi.fn();
    const seen: number[] = [];
    manager.setOnChange(onChange);
    const unsubscribe = manager.subscribe((balance) => seen.push(balance));

    manager.setBalance(250);

    expect(manager.getBalance()).toBe(250);
    expect(seen).toEqual([100, 250]);
    expect(onChange).not.toHaveBeenCalled();
    unsubscribe();
  });

  it("reports the signed delta after a successful buy and sell", () => {
    const manager = new EconomyManager(100);
    const deltas: number[] = [];
    manager.setOnChange((delta) => deltas.push(delta));

    manager.buy(30);
    manager.sell(5);

    expect(deltas).toEqual([-30, 5]);
    expect(manager.getBalance()).toBe(75);
  });

  it("does not report a delta for a rejected transaction", () => {
    const manager = new EconomyManager(100);
    const onChange = vi.fn();
    manager.setOnChange(onChange);

    manager.buy(101);
    manager.sell(Number.NaN);

    expect(onChange).not.toHaveBeenCalled();
  });

  it("notifies subscribers immediately with the current balance", () => {
    const manager = new EconomyManager(100);
    const seen: number[] = [];
    const unsubscribe = manager.subscribe((balance) => seen.push(balance));
    expect(seen).toEqual([100]);
    unsubscribe();
  });

  it("notifies subscribers after every buy and sell", () => {
    const manager = new EconomyManager(100);
    const seen: number[] = [];
    const unsubscribe = manager.subscribe((balance) => seen.push(balance));
    manager.buy(30);
    manager.sell(5);
    expect(seen).toEqual([100, 70, 75]);
    unsubscribe();
  });

  it("stops notifying after unsubscribe", () => {
    const manager = new EconomyManager(100);
    const listener = vi.fn();
    const unsubscribe = manager.subscribe(listener);
    unsubscribe();
    manager.buy(10);
    expect(listener).toHaveBeenCalledTimes(1); // only the initial call
  });

  it("notifies every subscriber", () => {
    const manager = new EconomyManager(10);
    const a = vi.fn();
    const b = vi.fn();
    manager.subscribe(a);
    manager.subscribe(b);
    manager.sell(5);
    expect(a).toHaveBeenLastCalledWith(15);
    expect(b).toHaveBeenLastCalledWith(15);
  });

  describe("buy", () => {
    it("deducts a valid cost", () => {
      const manager = new EconomyManager(100);
      expect(manager.buy(40)).toEqual({ success: true, balance: 60 });
      expect(manager.getBalance()).toBe(60);
    });

    it("allows spending the exact balance", () => {
      const manager = new EconomyManager(100);
      expect(manager.buy(100)).toEqual({ success: true, balance: 0 });
    });

    it("rejects a cost larger than the balance", () => {
      const manager = new EconomyManager(100);
      expect(manager.buy(101)).toEqual({
        success: false,
        balance: 100,
        error: "Insufficient funds",
      });
      expect(manager.getBalance()).toBe(100);
    });

    it("rejects negative and non-finite costs without changing the balance", () => {
      const manager = new EconomyManager(100);
      for (const bad of [-1, Number.NaN, Number.POSITIVE_INFINITY]) {
        const result = manager.buy(bad);
        expect(result.success).toBe(false);
        expect(result.balance).toBe(100);
        expect(result.error).toBeTruthy();
      }
      expect(manager.getBalance()).toBe(100);
    });
  });

  describe("sell", () => {
    it("adds valid earnings", () => {
      const manager = new EconomyManager(100);
      expect(manager.sell(25)).toEqual({ success: true, balance: 125 });
      expect(manager.getBalance()).toBe(125);
    });

    it("rejects negative and non-finite earnings without corrupting the balance", () => {
      const manager = new EconomyManager(100);
      for (const bad of [-1, Number.NaN, Number.POSITIVE_INFINITY]) {
        const result = manager.sell(bad);
        expect(result.success).toBe(false);
        expect(result.balance).toBe(100);
        expect(result.error).toBeTruthy();
      }
      expect(manager.getBalance()).toBe(100);
      expect(Number.isFinite(manager.getBalance())).toBe(true);
    });
  });

  describe("clearDebt", () => {
    it("returns zero when the balance is not negative", () => {
      const manager = new EconomyManager(100);
      const onChange = vi.fn();
      manager.setOnChange(onChange);
      expect(manager.clearDebt()).toBe(0);
      expect(manager.getBalance()).toBe(100);
      expect(onChange).not.toHaveBeenCalled();
    });

    it("wipes a negative balance and reports the windfall", () => {
      const manager = new EconomyManager(100);
      const deltas: number[] = [];
      manager.setOnChange((delta) => deltas.push(delta));
      manager.setBalance(-40);
      expect(manager.clearDebt()).toBe(40);
      expect(manager.getBalance()).toBe(0);
      expect(deltas).toEqual([40]);
    });

    it("notifies subscribers once the debt clears", () => {
      const manager = new EconomyManager(100);
      const seen: number[] = [];
      manager.subscribe((balance) => seen.push(balance));
      manager.setBalance(-5);
      manager.clearDebt();
      expect(seen).toEqual([100, -5, 0]);
    });
  });

  describe("canAfford", () => {
    it("is true for amounts up to the balance and false beyond it", () => {
      const manager = new EconomyManager(100);
      expect(manager.canAfford(0)).toBe(true);
      expect(manager.canAfford(100)).toBe(true);
      expect(manager.canAfford(100.01)).toBe(false);
    });

    it("is false for non-finite amounts", () => {
      const manager = new EconomyManager(100);
      expect(manager.canAfford(Number.NaN)).toBe(false);
      expect(manager.canAfford(Number.POSITIVE_INFINITY)).toBe(false);
    });
  });

  describe("admin", () => {
    it("can afford anything and buys without spending", () => {
      const manager = new EconomyManager(100);
      const onChange = vi.fn();
      manager.setOnChange(onChange);
      manager.setAdmin(true);

      expect(manager.isAdmin()).toBe(true);
      expect(manager.canAfford(1_000_000)).toBe(true);
      expect(manager.buy(1_000_000)).toEqual({ success: true, balance: 100 });
      expect(manager.getBalance()).toBe(100);
      expect(onChange).not.toHaveBeenCalled();
    });

    it("still rejects non-finite costs and restores normal spending on logout", () => {
      const manager = new EconomyManager(100);
      manager.setAdmin(true);
      expect(manager.buy(Number.POSITIVE_INFINITY).success).toBe(false);

      manager.setAdmin(false);
      expect(manager.isAdmin()).toBe(false);
      expect(manager.canAfford(101)).toBe(false);
      expect(manager.buy(101).error).toBe("Insufficient funds");
    });
  });

  describe("chips", () => {
    it("withdraws chips and reports the spend like a purchase", () => {
      const manager = new EconomyManager(100);
      const deltas: number[] = [];
      manager.setOnChange((delta) => deltas.push(delta));

      expect(manager.withdrawChips(25)).toBe(true);

      expect(manager.getBalance()).toBe(75);
      expect(deltas).toEqual([-25]);
    });

    it("refuses to withdraw more than the wallet holds", () => {
      const manager = new EconomyManager(100);
      expect(manager.withdrawChips(101)).toBe(false);
      expect(manager.getBalance()).toBe(100);
    });

    it("deposits a won pot back into the wallet", () => {
      const manager = new EconomyManager(100);
      const deltas: number[] = [];
      manager.setOnChange((delta) => deltas.push(delta));

      manager.depositChips(40);

      expect(manager.getBalance()).toBe(140);
      expect(deltas).toEqual([40]);
    });
  });
});
