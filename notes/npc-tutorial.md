# Farmhand starter quest

A placeholder farmhand stands beside the owner's farmhouse and walks a new
player through their first sale. He is deliberately plain: a brown rectangle
with a "Walt" name tag, no sprite sheet and no marketplace cameo (yet).

The quest belongs to a **farm**, keyed by the owner's username, and is
owner-only. Visitors never see him or his window: the `farm:<owner>` join reply
carries `npc: null` for non-owners.

## Stages

| Stage | Trigger to leave | What the player sees |
| --- | --- | --- |
| `intro` | Dismissing the welcome (`Escape`, ×, or "What do you need?") sends `npcIntroSeen` and shows the tomato order | One-time welcome line, no trade buttons |
| `tomatoes` | Handing in ten tomatoes | "Have you got those ten tomatoes for me yet?" + a disabled 0/10 card until the barn holds ten |
| `supplies` | Handing in ten lettuce **and** ten wheat | Two hand-in cards plus repeatable ten-seed bundles |
| `complete` | — | "Much obliged! Meet me at the market." then he disappears |

The trade menu is part of the same conversation: dismissing the welcome
records that it was seen and swaps the window over to the tomato order. From
there `Escape`/× close as usual and the next talk reopens on the current stage.

Handing in the tomato batch also gets its own **thank-you screen** before the
lettuce/wheat menu: the ack already moves the server to `supplies`, so the
client holds that menu back and shows his sale line with a "Got it" button
(mirroring the intro). It is client-only and not persisted — a reload lands on
the current stage. The final wheat hand-in skips it because the `complete`
screen already says the same line.

## Prices and quantities

Every hand-in and every seed bundle is a fixed batch of **ten**. Prices come
from the crop registry (`shared/crops.ts` / `Grange.Crops`); the client never
supplies an amount.

| Crop | Market sell | Batch payout |
| --- | ---: | ---: |
| Tomato | 5 | 50 GC |
| Lettuce | 7 | 70 GC |
| Wheat | 4 | 40 GC |

| Seed bundle | Market seed cost | Bundle price |
| --- | ---: | ---: |
| Lettuce | 4 | 40 GC |
| Wheat | 2 | 20 GC |

Seed bundles are repeatable and go through `/api/inventory/buy`, the same
endpoint the market uses, so they respect the server's stock cap and balance.

## Server rules

`Grange.NpcQuest` runs each trade in one Ecto transaction:

1. Reject a crop the current stage does not want (`"not looking for that"`).
2. Reject a crop already handed in (`"already handed in"`).
3. Remove ten from `barn_items` via `Barn.sell/3`, or roll back with
   `"you need ten <crop>"`.
4. Credit `users.balance` and bump `npc_quests.<crop>_sold`.
5. Derive the next stage from the counters and return `%{npc, balance}`.

`FarmChannel` restricts both `npcIntroSeen` and `npcSell` to the owner, then
refreshes the farm so the room sees the shrunken barn.

## Client wiring

| File | Concern |
| --- | --- |
| `src/world/farmNpc.ts` | The Excalibur actor (rectangle + name label) |
| `src/world/farmNpcPosition.ts` | Pure placement/prompt rules, offset from the farmhouse base (`x + 145, y + 40`) |
| `src/world/npcQuest.ts` | Pure card/offer/dialogue/label helpers plus the thank-you rule (Vitest-covered) |
| `src/world/npcStore.ts` | Mirror of the server `npc` status |
| `src/world/npcSocket.ts` | `npcIntroSeen` / `npcSell` channel emits |
| `src/world/useNpcTrade.ts` | Window open/close, acknowledgement, thank-you card, sale, seed purchase |
| `src/world/NpcTradeWindow.tsx` | Market-style frame, hand-in cards, seed bundles, thanks screen |

`FarmTravel` gives the farmhand priority over the house prompt, so standing
between them opens his window with `E`. If the farmhouse is dug into the
inventory, his anchor disappears and he hides with it.

The page exposes `data-npc-stage="intro|tomatoes|supplies|complete|none"` on
`main.farm-map-page` for Playwright, and the open window carries
`data-npc-thanks="<crop>|none"`.

## Test hook

`POST /api/dev/npc` (cookie auth, dev/test only) forces the quest state:

```json
{ "stage": "supplies", "counters": { "tomatoes": 10 }, "barn": { "lettuce": 10, "wheat": 10 } }
```

- Omitted `stage` is derived from the counters.
- Counters clamp to `0..10`; an unknown stage is a 400.
- `barn` is additive (`Barn.add/3`) and rejects unknown crop ids.
- The route broadcasts `npcUpdate` so an already-open farm tab catches up
  without rejoining.

`e2e/npc.spec.ts` uses it to walk the whole quest in one test: welcome into the
tomato order, disabled 0/10 card, the tomato payout's thank-you screen, seed
bundle, both supply hand-ins, and the final disappearance (also after a
reload).

Unit coverage: `src/world/npcQuest.test.ts`,
`src/world/farmNpcPosition.test.ts`, `backend/test/grange/npc_quest_test.exs`,
plus the channel cases in `backend/test/grange_web/channels/farm_channel_test.exs`.

## Not built

- Real artwork; the rectangle is intentional for now.
- A marketplace appearance after `complete`; he simply hides.
- Partial hand-ins (e.g. 3 of 10); batches are all-or-nothing.
- Any reward beyond market price.
