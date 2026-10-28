import { describe, expect, it } from "vitest";
import { reconcileServerItems } from "./itemSync";

function actions(held: Record<string, number>) {
  const added: Array<[string, number]> = [];
  return {
    added,
    countItem: (id: string) => held[id] ?? 0,
    addItem: (id: string, count: number) => added.push([id, count]),
  };
}

describe("reconcileServerItems", () => {
  it("tops up rods and fish the server knows about", () => {
    const a = actions({});
    reconcileServerItems({ fiberglass: 1, minnow: 3 }, a);
    expect(a.added).toContainEqual(["fiberglass", 1]);
    expect(a.added).toContainEqual(["minnow", 3]);
  });

  it("adds only the missing difference", () => {
    const a = actions({ minnow: 1 });
    reconcileServerItems({ minnow: 4 }, a);
    expect(a.added).toEqual([["minnow", 3]]);
  });

  it("never strips the free starter rod or a larger local stack", () => {
    const a = actions({ bamboo: 1, master: 1, salmon: 9 });
    reconcileServerItems({}, a);
    expect(a.added).toEqual([]);
  });

  it("ignores items outside the rod and fish catalog", () => {
    const a = actions({});
    reconcileServerItems({ tomato: 5, hoe: 1 }, a);
    expect(a.added).toEqual([]);
  });
});
