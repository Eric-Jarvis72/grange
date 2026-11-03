# Hub multiplayer

The marketplace and casino are shared spaces. Every signed-in player in the same
area sees the other players' farmer avatars moving around, with their username
above their head. Farms are **not** hubs: they keep their own per-farm presence
and visitor rules, documented in `notes/farm-multiplayer.md`.

## Topics and events

| | |
| --- | --- |
| Topics | `hub:marketplace`, `hub:casino` |
| Join | Authenticated socket only; area must be `marketplace` or `casino` |
| Join reply | `%{area: "marketplace"}` followed by Phoenix `presence_state` |
| Client event | `move` with `%{"x" => number, "y" => number}` |
| Server push | Standard `presence_state` / `presence_diff` |
| Presence meta | `%{name: username, x: x, y: y, at: epoch_ms}` |

Presence is keyed by **username**, so one account has one avatar. A second tab
adds another meta under the same key; the client picks the meta with the newest
`at` and ignores the rest.

`move` replies `:ok` when accepted and `{:error, %{error: "move ignored"}}`
when the payload is malformed, outside the map, or arrives less than 50 ms after
the previous accepted move. The client ignores replies.

Coordinates are clamped to `x 16..1136`, `y 32..752` (the same pixel bounds
`playerMovement` uses). Positions are cosmetic: the server never simulates
movement or collision.

Presence is ephemeral and in-memory. Nothing is written to SQLite, and no
migration is involved. When a channel process exits, Phoenix's tracker removes
its entries automatically.

## Client flow

1. `WalkingScene.onActivate` calls `joinHub(area)` for hub scenes (marketplace
   and casino pass `hubArea`; the farm scene never does).
2. `src/world/hubClient.ts` joins the channel, builds a `Presence`, and keeps a
   snapshot of peers. It filters out the local username and peers that have not
   reported a position yet.
3. Each frame, `WalkingScene.onPreUpdate` calls `publishHubPosition`, throttled
   to 10 Hz with a 1.5 px dead-band, then reads `getHubPeers()`.
4. `src/world/hubPlayers.ts` adds/removes remote actors, eases them toward their
   reported positions (snapping beyond 250 px), and drives the shared farmer
   walk animation. Sprites and labels use `depthForY(y)` so they sort with props
   exactly like the local player. It also draws the local player's own label.
5. `onDeactivate` clears remote avatars and leaves the channel.

React only sees peer **names** (`subscribeHubPeers`), which change on join/leave,
not on movement. `FarmMap` exposes them as `data-hub-peers` for e2e tests.

## Tuning

| Constant | Where | Meaning |
| --- | --- | --- |
| `SEND_INTERVAL_MS` (100) | `hubClient.ts` | Max movement messages per second |
| `MIN_SEND_DISTANCE` (1.5) | `hubClient.ts` | Dead-band in world pixels |
| `@min_move_interval_ms` (50) | `hub_channel.ex` | Server-side abuse guard |
| `REMOTE_LERP_RATE` (12) | `hubInterpolation.ts` | Easing speed per second |
| `REMOTE_SNAP_DISTANCE` (250) | `hubInterpolation.ts` | Teleport threshold |

## What is intentionally missing

- No player-vs-player collision; avatars can overlap.
- No chat, emotes, or profile cards.
- No interest management; everyone in an area receives every presence update.
- No persistence of player positions across sessions or server restarts.
