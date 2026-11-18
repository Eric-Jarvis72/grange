# Farm multiplayer

Farms can be visited, but they are not hubs: there is no cross-farm presence and
each farm keeps its own room. A farm's owner decides whether strangers may join
and whether visitors may edit the farm.

## Topics and events

Everything lives on the existing `farm:<owner>` channel.

| | |
| --- | --- |
| Join | Authenticated socket only. Owners always join; strangers only while the farm is public |
| Join reply | `%{farm: ActiveFarm}` followed by Phoenix `presence_state` |
| Client events | `farmAction`, `gateAction`, `farmPropAction`, `sellProduce`, `updateSettings`, `move` |
| Server pushes | `farmUpdate` (whole farm), `presence_state` / `presence_diff` |
| Presence meta | `%{name: username, x: x, y: y, at: epoch_ms}` |

Every signed-in visitor sees the other people on the same farm, with their
username above their head. Presence is keyed by username, so one account has one
avatar even with two tabs open. Positions are cosmetic and clamped exactly like
hub positions (`x 16..1136`, `y 32..752`); `move` is throttled to one accepted
update every 50 ms.

## Farm settings

Two persisted flags live on the `farms` row and are exposed on `ActiveFarm`:

| Flag | Default | Meaning |
| --- | --- | --- |
| `is_public` | `false` | Strangers may join the farm |
| `visitor_edit` | `false` | Visitors may perform farm actions |

The owner changes them from the farmhouse menu (`E`/`Enter` near the
farmhouse, within `FARM_HOUSE_REACH`). `updateSettings` is owner-only and
broadcasts a fresh `farmUpdate`.

- Going private affects **new joins only**. Anyone already in the room keeps
  receiving updates until they leave; there is no kick.
- Turning editing off takes effect immediately because the server re-reads the
  flag on every `farmAction` and `farmPropAction`.
- Visitors may still walk around and toggle gates when editing is off.
- Selling produce, the bank, livestock purchases, fishing, and settings remain
  owner-only.

## What visitors may do

With `visitor_edit` on, visitors may till, plant, water, and harvest; place and
remove fences and gates; and dig or place movable props.

The farm itself is server-authoritative and shared, but actor-owned state is
per-player:

- Planting spends the **actor's** seeds (`inventory_items`), not the owner's.
- Harvest mutation drops go to the **actor's** seed inventory.
- Harvested produce goes to the **owner's** barn.

## Notifications and travel

- A public farm appears in the dashboard and in the train destination menu.
  Private farms are hidden rather than shown as locked rows.
- The train opens a destination menu before the departure animation:
  - own farm: Marketplace + other public farms,
  - marketplace: Your Farm + other public farms,
  - guest farm: Your Farm + Marketplace + other public farms.
- `trainDestinations` in `src/world/travelDestinations.ts` owns those rules and
  is unit tested.
- Farm-to-farm and guest-to-marketplace trips remount the world through the
  router with a one-shot `markTrainArrival` flag; trips inside the local world
  switch Excalibur scenes directly.

## Client flow

1. `src/world/FarmMap.tsx` joins `farm:<owner>` while the farm area is active.
   Entering a hub pauses farm presence but keeps the channel joined so
   owner-only actions like `sellProduce` still reach the server.
2. `src/socket.ts` stores the joined channel, forwards `farmUpdate`, and attaches
   farm presence.
3. `FarmScenePresence` publishes the local position each frame through
   `src/world/farmPresence.ts` (10 Hz, 1.5 px dead-band) and drives
   `HubPlayers` with `getFarmPeers()`.
4. React only sees peer **names** (`subscribeFarmPeers`); `FarmMap` exposes them
   as `data-farm-peers` for e2e tests.

## What is intentionally missing

- No player-vs-player collision; farm avatars can overlap.
- Remote avatars and their name labels share the prop depth band
  (`depthForY(y)`), so buildings occlude them correctly.
- No chat, emotes, or profile cards.
- No authorization middleware beyond the channel; settings are checked there.
- No interest management; everyone on a farm receives every presence update.
- No persistence of farm visitor positions across sessions or restarts.
