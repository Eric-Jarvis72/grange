# AGENTS.md — Working on Grange

This file is the onboarding document for AI coding agents (and new humans)
working on **Grange**, a small multiplayer farming game. It describes the
actual current implementation, not an aspirational design. When this file and
the code disagree, **the code wins** — update this file when you learn
something new.

> Quick mental model: React/Vite/Excalibur SPA in the browser, Elixir/Phoenix
> in the backend, SQLite through Ecto, and gameplay traffic over Phoenix
> Channels. Auth and balance sync are plain JSON over HTTP.

---

## 1. Prime directives

1. **Do not push to `main`.** Changes go through a PR from a feature branch.
   The required CI check is the `test` job. Squash merges only. See
   `notes/change-policy.md`.
2. **Run the checks before declaring success.** At minimum:
   `pnpm lint && pnpm test && pnpm test:backend && pnpm build`. Run
   `pnpm test:e2e` for any change that touches routing, the canvas, HUD,
   inventory, markets, or casino overlays.
3. **Keep files small.** JS/TS files in `src/`, `shared/`, `e2e/`, and
   `scripts/` must stay under **300 code lines / 500 total lines**. Elixir
   files have the same cap via a custom Credo check. Split concerns into small
   modules/helpers rather than growing a file.
4. **Keep duplicated rules in sync.** The crop registry and mechanics exist in
   both TypeScript (`shared/`) and Elixir (`backend/lib/grange/crops.ex`).
   `shared/` is shared across the frontend, **not** importable by Elixir.
5. **Never commit generated or secret files.** No `.env`, SQLite files,
   `backend/priv/static`, `node_modules`, logs, or build output.
   `scripts/repo-sanity.mjs` enforces this.
6. **Do not rename or remove `data-testid` values casually.** Playwright relies
   on them heavily. Add new ones when adding UI.
7. **Do not edit old migrations.** Add a new timestamped migration; migrations
   run automatically on boot in every environment.

---

## 2. What the game is

Grange is a peaceful farming game with a hub world:

- Start on your own farm with a run-down farmhouse, barn, fields, and a train.
- Till, plant, water, and harvest crops. Crops can mutate into rare variants.
- Buy seeds at the marketplace; sell produce from the barn.
- Take the train between your farm, the marketplace, and the casino.
- Casino games (blackjack, poker, roulette, slots) spend and return
  Grangecoin.
- Visit other players' farms read-only by default; owners can make a farm
  public and let visitors farm, build, and move props.
- Fences and gates are placed from the hotbar; props (buildings, trees, decor)
  can be dug up and moved.

The game is under active course-project development. Some UI is stubbed
(Settings, whitelist management, some market tabs) and some behavior is
client-only. See [Known gaps](#14-known-gaps-and-inconsistencies).

---

## 3. Stack

### Frontend (`src/`, `shared/`)

| Concern | Technology |
| --- | --- |
| UI | React 18 + TypeScript 5 (strict) |
| Build/dev server | Vite 5 |
| Routing | React Router DOM 6 |
| State | Zustand 4 |
| Styling | Tailwind CSS 4 (`@tailwindcss/vite`), plain CSS for HUD/game overlays |
| Game rendering | Excalibur.js 0.32 (canvas, pixel art) |
| Realtime | `phoenix` JS client (Phoenix Channels) |
| Fonts | `@fontsource/rye` (display font) |
| Unit tests | Vitest 2 (node environment) |
| E2E | Playwright (`@playwright/test`) |

### Backend (`backend/`)

| Concern | Technology |
| --- | --- |
| Language/runtime | Elixir (`~> 1.14`; CI uses OTP 28 / Elixir 1.20) |
| Web | Phoenix 1.7, Bandit adapter |
| Realtime | Phoenix Channels + PubSub |
| Persistence | Ecto SQL + `ecto_sqlite3` (SQLite) |
| Passwords | Argon2 (`argon2_elixir`) |
| JSON | Jason |
| Tests | ExUnit |
| Lint | `mix format` + Credo strict |
| Build | Mix release |

### Toolchain / repository

- `mise.toml` pins Node 24, pnpm 11, Erlang/Elixir.
- `pnpm` is the JS package manager. There is a root `package.json`; the
  `backend/` directory is a separate Mix project.
- CI is `.github/workflows/ci.yml`; deploy is a Mix release synced to a
  systemd host (`deploy/`).

---

## 4. Quick start and commands

```sh
mise install          # install Node, pnpm, Erlang, Elixir
pnpm setup            # installs JS + Elixir deps (idempotent)
pnpm dev              # Phoenix on :3200 + Vite on :3000
```

Open <http://localhost:3000/>. Vite proxies `/socket` (WebSocket) and `/api`
to Phoenix on `:3200`.

### Scripts

| Command | What it does |
| --- | --- |
| `pnpm dev` | Runs backend and Vite concurrently |
| `pnpm dev:backend` | `node scripts/run-mix.mjs phx.server` |
| `pnpm dev:web` | `vite` |
| `pnpm build` | `tsc -p tsconfig.json && vite build` into `backend/priv/static` |
| `pnpm start` | Runs the Phoenix server (`mix phx.server`) |
| `pnpm test` | Vitest, all `**/*.test.ts(x)` |
| `pnpm test:backend` | ExUnit |
| `pnpm test:e2e` | Builds the SPA, then Playwright against Phoenix |
| `pnpm test:e2e:run` | Playwright only, no rebuild (used by CI after `check`) |
| `pnpm test:e2e:install` | Installs Chromium for Playwright |
| `pnpm lint` | Biome lint + file-size check + repo sanity |
| `pnpm lint:backend` | `mix format --check-formatted` + `mix credo --strict` |
| `pnpm sanity` | Checks committed files for junk/secrets/large files |
| `pnpm check` | lint + unit + backend + build |
| `pnpm format` | Biome format write (JS/TS/CSS in `src/` and `shared/`) |
| `pnpm setup` / `pnpm bootstrap` | Installs JS and Elixir deps |
| `pnpm hooks:install` | Reinstalls git hooks that re-bootstrap deps |

### Focused test runs

```sh
pnpm exec vitest run src/world/farmActions.test.ts
node scripts/run-mix.mjs test test/grange/crops_test.exs
pnpm exec playwright test e2e/farm.spec.ts
```

### Formatting

- Frontend: `pnpm format` (Biome). The formatter uses **tabs**, **double
  quotes**, and organizes imports.
- Backend: `node scripts/run-mix.mjs format` (or `cd backend && mix format`).

---

## 5. Architecture

### 5.1 Development vs production topology

```
Development
  browser ──HTTP──▶ Vite :3000 ──proxy /api──▶ Phoenix :3200
          ──WS────▶ Vite :3000 ──proxy /socket──▶ Phoenix :3200

Production / e2e
  browser ──HTTP + WS──▶ Phoenix :3200
                           ├─ /api/*        JSON controllers
                           ├─ /socket       Phoenix Channels
                           ├─ /assets/*     static files (Plug.Static)
                           └─ /*            built SPA (index.html fallback)
```

- `vite.config.ts` builds to `backend/priv/static` and proxies `/api` and
  `/socket` (WebSocket upgraded) in both `server` and `preview`.
- `playwright.config.ts` starts Phoenix with `MIX_ENV=dev` on port `3201` and
  serves the **built** SPA from `backend/priv/static`; no Vite in e2e.

### 5.2 Frontend bootstrap

- `index.html` mounts `#root`.
- `src/main.tsx`:
  - wires `economy.setOnChange(saveBalanceDelta)` so balance changes sync,
  - calls `initSocket()` (opens the lobby channel),
  - renders `<BrowserRouter><App /></BrowserRouter>`.
- `src/App.tsx` routes:
  - `/` → `MainMenu`
  - `/login` → `Login` (sign in / create account)
  - `/world` → `RequireAuth` + `FarmMap` (own farm)
  - `/farms/:owner` → `RequireAuth` + `FarmMap` (visitor view)
  - `/dashboard` → `RequireAuth` + `Dashboard` (lobby: players, farms, visit)
- `RequireAuth` resolves the session before rendering, and redirects to `/` if
  unauthenticated.
- `useSession` calls `fetchMe()` once and returns `{ready, signedIn}`.

### 5.3 Backend supervision tree

`Grange.Application` starts, in order:

1. `Phoenix.PubSub` as `Grange.PubSub`
2. `Grange.Repo` (Ecto/SQLite)
3. `Grange.FarmTicker` (unless `start_ticker: false`, as in tests)
4. `GrangeWeb.Endpoint` (Bandit)

After the supervisor starts, `Grange.Application.migrate/0` runs all migrations
from `backend/priv/repo/migrations`. This is how dev, test, and production
releases stay current; there is no separate release migration task.

### 5.4 Authentication and sessions

- Accounts and sessions live in SQLite (`users`, `sessions`).
- `POST /api/auth/register` and `POST /api/auth/login` validate credentials,
  create a session, set an `httpOnly` cookie (`_grange_key`, session key
  `:user_token`), and return `{ok, user, token}`.
- `GET /api/auth/me` resolves the cookie and returns `{ok, user, token}` or
  `401 {ok: false, error}`.
- `POST /api/auth/logout` deletes the session row and clears the cookie.
- The opaque token is also stored in the browser and sent as a **connect
  param** to the Phoenix socket. `GrangeWeb.UserSocket.connect/3` calls
  `Accounts.resolve_token/1` and assigns the user to the socket. Channels never
  trust a client-supplied username.
- `rebindAuth()` (in `src/socket.ts`) disconnects and reconnects the socket
  after sign-in/out so the handshake carries the new token.
- Passwords are Argon2-hashed. Sessions are 30 days; only a SHA-256 hex hash of
  the token is stored.
- `is_admin` is a DB flag. On sign-in the client grants the full item catalog
  **client-side**; there is no server-side admin authorization middleware.

### 5.5 HTTP API (non-channel)

All routes are same-origin JSON under `/api` and accept/return JSON. Session
auth is the `_grange_key` cookie; the socket uses the token instead.

| Method | Path | Auth | Notes |
| --- | --- | --- | --- |
| POST | `/api/auth/register` | none | `{username, email, password}` → `{ok, user, token}` |
| POST | `/api/auth/login` | none | `{username, password}` → `{ok, user, token}` |
| GET | `/api/auth/me` | cookie | `{ok, user, token}` or 401 |
| POST | `/api/auth/logout` | cookie | Destroys the session, clears the cookie |
| POST | `/api/economy/transaction` | cookie | `{delta}` integer; clamped at zero |
| POST | `/api/hardware/buy` | cookie | `{item, quantity}` → `{balance, sprinkler_count}` |
| GET | `/api/state` | none | `{playerCount, farmCount}` |
| POST | `/api/reset` | none | Dev/test only; wipes accounts and farms |

Unmatched `/api/*` routes return JSON 404 before the SPA fallback. Every other
path serves the built `index.html`.

### 5.6 Phoenix Channels protocol

The SPA uses one shared socket and three channel families:

#### `lobby`

Join reply:

```json
{ "players": [{ "name": "Alice" }],
  "farms": [{ "owner": "Alice", "tiles": 3, "planted": 1, "watered": 1, "ready": 1, "tomatoes": 0 }] }
```

- Server pushes `players` → `{players}` when a new account registers.
- Server pushes `farms` → `{farms}` when any farm changes.
- Client can push `farms` (empty payload) to force a refresh; reply is
  `{farms}`.

#### `farm:<owner>`

Join reply: `{ "farm": <ActiveFarm> }` followed by Phoenix
`presence_state` / `presence_diff`. Only signed-in sockets may join. The
joining account's own farm is created on demand (`FarmStore.ensure/1`) so its
seed ledger exists even when it is only visiting.

- The owner always joins their own farm.
- A stranger may join only while the farm is public (`farms.is_public`).
- Private farms are hidden from the dashboard and train menu; existing visitors
  are never kicked when a farm turns private.

Server pushes `farmUpdate` → `{ "farm": <ActiveFarm> }` after every successful
change. There is **no partial/delta update**: the client replaces the whole
active farm.

Client events:

| Event | Payload | Allowed caller | Success | Error |
| --- | --- | --- | --- | --- |
| `farmAction` | `{action: FarmAction}` | owner, or visitor while `visitor_edit` | `{seeds, drops}` | `{error, seeds}` |
| `gateAction` | `{action: {kind: "toggle_gate", x, y}}` | any joined user | `:ok` | `{error: reason}` |
| `farmPropAction` | `{action: {kind: "dig", index} \| {kind: "place", asset, x, y}}` | owner, or visitor while `visitor_edit` | `:ok` | `{error: reason}` |
| `sellProduce` | `{item: cropId, count: integer}` | farm owner only | `:ok` | `{error: reason}` |
| `updateSettings` | `{is_public?, visitor_edit?}` | farm owner only | `{farm}` | `{error: reason}` |
| `move` | `{x, y}` | any joined user | `:ok` | `{error: "move ignored"}` |
| `pausePresence` | `{}` | any joined user | `:ok` | `{error: reason}` |
| `resumePresence` | `{}` | any joined user | `:ok` | `{error: reason}` |

Phoenix error replies are `{:reply, {:error, %{error: reason}}, socket}`.
On the client, `reasonOf()` in `src/socket.ts` reads `error` or `reason` from
the reply payload.

Authorization rules (`FarmChannel`):

- Unauthenticated sockets cannot join at all (though they may still join
  `lobby`).
- Farm actions require the owner or a farm whose `visitor_edit` is on.
- The flag is re-read on every action, so revoking editing blocks the next
  in-flight action immediately.
- Visitors may always toggle gates; placing/removing fences and gates is an
  edit action.
- Prop actions, produce sales, and settings are owner-only (with the same
  `visitor_edit` gate for props).
- Seed spending and mutation drops follow the actor; harvested produce goes to
  the owner's barn.

Farm presence is cosmetic and keyed by username, exactly like hub presence. It
lives on this channel; there is no separate farm-presence channel or table.
Entering a hub sends `pausePresence` (the channel stays joined so owner-only
actions still work) and returning sends `resumePresence`.

#### `hub:<area>`

The shared hub areas: `hub:marketplace` and `hub:casino`. These are the only
multiplayer spaces. Farms never join a hub channel.

- Join requires a signed-in socket (`{"error": "not logged in"}` otherwise) and
  an area of `marketplace` or `casino` (`"unknown area"` otherwise). The reply is
  `{ "area": "<area>" }`; Phoenix then pushes `presence_state` / `presence_diff`.
- Presence is keyed by **username** with meta
  `{ "name", "x", "y", "at" }` (`at` is epoch ms). A second tab adds another
  meta under the same key; the client shows only the newest one.
- Client event `move` with `{x, y}` updates this channel's presence meta.
  Positions are clamped to `x 16..1136`, `y 32..752` and moves closer than 50 ms
  apart are rejected with `{error: "move ignored"}`. Replies are otherwise `:ok`.
- Hub positions are **cosmetic**. The server does not simulate movement,
  collision, or persistence, and presence is in-memory only.

See `notes/hub-multiplayer.md` for the client flow and tuning constants.

### 5.7 Farm action round trip

1. Hotbar selection determines the held `ItemId` (`src/inventory/inventoryStore.ts`).
2. `farmToolForItem()` maps it to `hoe | seed | bucket | scythe` or `null`.
3. `resolveAction()` (`src/world/farmActions.ts`) decides the intent
   (`till`, `plant`, `water`, `harvest`) from the held tool and the current
   server tile.
4. `performFarmAction()` (`src/world/farmActionRunner.ts`):
   - records the combo (`ComboController`),
   - plays the scythe sweep FX,
   - possibly emits a combo-spread action to an orthogonal neighbor,
   - emits `farmAction` with `{kind, x, y, crop?, tool?, comboMutationMultiplier?}`.
5. `FarmChannel.handle_in("farmAction", ...)` authorizes the owner or a
   visitor while `visitor_edit` is on, then calls
   `FarmStore.action(owner, action, actor)`.
6. `FarmStore` normalizes the action, runs it in an Ecto transaction, persists
   the change, spends the actor's seed, persists any mutation drop in the
   actor's inventory, and broadcasts `farmUpdate` + lobby `farms`. Harvested
   produce goes to the owner's barn.
7. The `farmAction` ack returns `{seeds, drops}` (or `{error, seeds}`); the
   client applies the authoritative seed counts and announces any drop.
8. `src/socket.ts` receives `farmUpdate`, calls
   `useGameStore.setActiveFarm(farm)`.
9. `FarmMapScene.onPreUpdate` calls `FarmTileSync.sync()` and repaints only
   changed tiles; `useBarnReconcile` reconciles produce items to the barn.

The farm is **server-authoritative**. There are no optimistic tile updates.

### 5.8 Economy flow

`EconomyManager` (`src/world/EconomyManager.ts`) is a singleton with:

- `getBalance()`, `setBalance(n)`, `subscribe(cb)`, `useEconomyBalance()`
- `buy(cost)`, `sell(earnings)` — validate finite, non-negative amounts, update
  the local balance, notify listeners, and fire `onChange(delta)`
- `withdrawChips(amount)` / `depositChips(amount)` — aliases used by casino
  tables

`src/auth.ts` registers `saveBalanceDelta` as `onChange`, so every successful
buy/sell POSTs `{delta}` to `/api/economy/transaction`. The server clamps the
stored balance at zero and treats the delta as an integer. `setBalance` (used
when loading `/me`) does **not** report a delta, avoiding feedback loops.

Market behavior:

- **Seeds** are bought locally: the server is not involved; `EconomyManager`
  spends Grangecoin and the seed is added to the browser inventory.
- **Produce** is sold server-side: the client emits `sellProduce`, the server
  decrements the `barn_items` row, then the client adds the sale price locally.
- The barn is the source of truth for produce; `useBarnReconcile` makes the
  local inventory match it idempotently.

### 5.9 World, scenes, and travel

`src/world/FarmMap.tsx` creates one Excalibur `Engine` with viewport
**1152×768** (`18 × 12` tiles of `64px`) and three scenes:

- `farm-map` → `FarmMapScene`
- `marketplace` → `MarketplaceScene`
- `casino` → `CasinoScene`

`MarketplaceScene` and `CasinoScene` extend `WalkingScene`, which provides
WASD/arrow movement, obstacle collision, `E`/`Enter` interactions, prompts, and
scene travel. `FarmMapScene` is more specialized: farming tools, pointer
painting, hover readout, fences/gates, prop placement, combo tracker, train
animation, and travel to the marketplace.

The Excalibur engine is created as soon as the route has a farm target; the
world only becomes interactive after the farm channel join supplies
`activeFarm` (`data-world-ready="true"` requires it). Only the boot scene's
images block the first frame (`worldAssets.ts`): the engine starts once that
scene can draw, and `preloadWorldResources` warms the other scenes in the
background. Travel awaits `ensureSceneResources(destination)` so a fast player
never lands in a blank scene. The scene waits for store updates rather than
gating engine construction.

DOM overlays (inventory, pause menu, market window, casino game overlays) pause
the active scene via `scene.setPaused(true)` and/or
`isInventoryBlockingInput()` so movement and tool input are frozen.

The train (`TrainController`) animates departures/arrivals and gates boarding.
Boarding opens the `TravelMenu` instead of leaving directly; the local player
picks a destination and only then does the departure animation play.
`trainDestinations()` in `src/world/travelDestinations.ts` builds the list:

- own farm: Marketplace + other public farms,
- marketplace: Your Farm + other public farms,
- guest farm: Your Farm + Marketplace + other public farms.

Farm-to-farm and guest-to-marketplace trips remount the world through the
router with a one-shot `markTrainArrival()` flag; trips inside the local farm's
world switch Excalibur scenes directly. Spawn points live in `mapData.ts`,
`marketplaceData.ts`, and `casinoData.ts`.

The owner opens the `HouseMenu` by pressing `E`/`Enter` within
`FARM_HOUSE_REACH` of the farmhouse. It toggles `is_public` and `visitor_edit`;
both overlays pause the active scene while open.

The marketplace and casino are **hub areas**: a `WalkingScene` with `hubArea`
joins `hub:<area>` on activate, leaves on deactivate, and publishes the local
position at ~10 Hz while moving. `HubPlayers` renders the other players from
`getHubPeers()`, easing them toward their reported positions with usernames
above their heads.

Farms are not hubs, but they have their own `farm:<owner>` presence:
`FarmScenePresence` publishes the local position and renders the other people
in the same room through `getFarmPeers()`. `FarmMap` exposes the current hub and
farm peer names as `data-hub-peers` / `data-farm-peers` for e2e tests; they are
not rendered UI.

---

## 6. Repository map

```
.
├── AGENTS.md                  ← this file
├── README.md                  ← human-facing setup/deploy overview
├── package.json               ← root JS scripts/deps
├── pnpm-workspace.yaml        ← pnpm build allow-list only
├── vite.config.ts             ← SPA build to backend/priv/static + dev proxy
├── playwright.config.ts       ← e2e against Phoenix on :3201
├── biome.json                 ← JS/TS/CSS lint + format config
├── mise.toml                  ← pinned toolchain
├── index.html                 ← SPA shell
├── public/assets/             ← all game art (served at /assets)
├── shared/                    ← TypeScript contracts/common logic
│   ├── auth.ts                ← User/AuthUser/Session types
│   ├── crops.ts               ← crop registry (single TS source of truth)
│   ├── farm.ts                ← tile types, grid constants, crop encode/decode
│   ├── mechanics.ts           ← combo/synergy/mutation tuning
│   └── types.ts               ← channel/wire payload types
├── src/
│   ├── main.tsx / App.tsx     ← bootstrap + routes
│   ├── auth.ts                ← HTTP auth + balance sync + socket rebind
│   ├── socket.ts              ← Phoenix socket + channel wrappers
│   ├── store.ts               ← Zustand game store (user, players, farms)
│   ├── config.ts              ← version/watermark
│   ├── useSession.ts          ← session resolution
│   ├── routes/                ← MainMenu, Login, Dashboard, RequireAuth
│   ├── inventory/             ← hotbar, inventory modal, item registry, keys
│   ├── notifications/         ← bottom-left feed store + component
│   ├── pause/                 ← pause menu overlay + store
│   └── world/
│       ├── FarmMap.tsx        ← engine/scene host + HUD glue
│       ├── FarmMapScene.ts    ← farm gameplay scene
│       ├── WalkingScene.ts    ← base scene for marketplace/casino
│       ├── MarketplaceScene.ts / CasinoScene.ts
│       ├── hubClient.ts       ← hub channel, presence peers, move throttle
│       ├── hubPlayers.ts      ← remote avatars + username labels
│       ├── hubInterpolation.ts← easing/snap helpers (tested)
│       ├── mapData.ts         ← terrain/props/grid/spawn constants
│       ├── marketplaceData.ts / casinoData.ts
│       ├── testMode.ts        ← dev-only e2e hooks (boot scene, walk speed)
│       ├── farmActions.ts     ← pure action resolution + synergy + drops
│       ├── farmActionRunner.ts← emit farming actions + combo/sweep
│       ├── combo* / farmCombo ← combo tracker/controller/store/HUD
│       ├── tileSync / farmSceneTiles / cropLayer
│       ├── fence* / gateInteraction / blocking
│       ├── farmProp* / propLayer / placement previews
│       ├── marketData / useFarmMarket / MarketWindow
│       ├── blackjack*, poker*, roulette*, slots* ← client-side casino games
│       ├── resources.ts / *Resources.ts ← Excalibur image sources
│       ├── worldAssets.ts     ← per-scene image groups + lazy loading
│       └── walkCollisions / sceneObstacles / playerMovement / train
├── backend/
│   ├── mix.exs
│   ├── config/{config,dev,test,prod,runtime}.exs
│   ├── lib/grange/
│   │   ├── application.ex     ← supervision + boot migrations
│   │   ├── repo.ex            ← Ecto SQLite repo
│   │   ├── accounts.ex        ← registration/login/sessions/balance
│   │   ├── farm_store.ex      ← farm transactions, views, tick, broadcasts
│   │   ├── farm_ticker.ex     ← 1s GenServer driving FarmStore.tick/0
│   │   ├── farm_tick.ex       ← per-tick sweep: ripen, revert untended soil
│   │   ├── farm.ex            ← pure tile state machine + bounds
│   │   ├── hub.ex             ← hub area whitelist + position clamping
│   │   ├── crops.ex           ← Elixir mirror of crop registry/mechanics
│   │   ├── farm_action.ex     ← action opts + mutation drop roll
│   │   ├── barn.ex / barn_item.ex
│   │   ├── farm_fences.ex / farm_gates.ex / farm_props.ex
│   │   ├── farm_gate_actions.ex ← visitor-safe gate toggle
│   │   ├── farm_record.ex / tile.ex / user.ex / session.ex
│   │   └── farm_fence.ex / farm_gate.ex / farm_prop.ex
│   ├── lib/grange_web/
│   │   ├── endpoint.ex        ← socket + static + session + router
│   │   ├── router.ex          ← /api routes + SPA fallback
│   │   ├── user_socket.ex     ← token auth in connect params
│   │   ├── presence.ex        ← ephemeral hub presence tracker
│   │   ├── channels/{lobby,farm,hub}_channel.ex
│   │   └── controllers/{auth,economy,health,page,fallback}_controller.ex
│   ├── priv/repo/migrations/  ← auto-run on boot
│   └── test/                  ← ExUnit + support helpers + Credo checks
├── e2e/                       ← Playwright specs + shared helpers
├── scripts/                   ← bootstrap, run-mix, lint/size/sanity, art
├── deploy/                    ← systemd unit, env, deploy script
└── notes/                     ← design, mechanics, policy, history
```

### Important note about `notes/`

- `notes/farming-mechanics.md` is the best gameplay reference.
- `notes/sqlite-plan.md` is a **historical design proposal**. The current
  `FarmStore` is a plain module that reads/writes Ecto directly — it is not the
  write-behind cache described there. Trust the code.
- `notes/update-phoenix-backend-pr.md` is migration history, not current
  architecture.
- `notes/change-policy.md` is current and authoritative for PR policy.

---

## 7. Data model and wire contracts

### 7.1 SQLite tables

| Table | Key columns | Notes |
| --- | --- | --- |
| `users` | `id` string PK, `username` unique, `email` unique, `password_hash`, `balance` default 100, `is_admin` default false, `inserted_at` | IDs are 32-char lowercase hex strings. No `updated_at`. |
| `sessions` | `token_hash` string PK, `user_id` FK → `users.id`, `expires_at`, `inserted_at` | Only the SHA-256 hash is stored. |
| `farms` | `owner` string PK (username), `tomatoes` legacy integer, `fence_count` default 20, `gate_count` default 2, `sprinkler_count` default 0, `is_public` default false, `visitor_edit` default false, timestamps | Owner is the **username**, not `users.id`. Settings default to private/read-only. |
| `tiles` | `id`, `owner` FK → `farms.owner`, `x`, `y`, `state` string, `crop` string, `planted_at`/`watered_at`/`ready_at`/`tilled_at` integer ms | Unique `(owner, x, y)`. `state` is one of `tilled`, `planted`, `watered`, `ready`. `tilled_at` is set while the tile is bare `tilled` ground so `FarmTick` can revert abandoned soil to grass. |
| `barn_items` | `owner` FK, `item`, `count` | Unique `(owner, item)`. `item` is a crop id. |
| `farm_fences` | `owner` FK, `x`, `y` | Unique `(owner, x, y)`. |
| `farm_gates` | `owner` FK, `x`, `y`, `direction`, `open` | Unique `(owner, x, y)`. `direction` is `horizontal` or `vertical`. |
| `farm_sprinklers` | `owner` FK, `x`, `y` | Unique `(owner, x, y)`. `(x, y)` is the top-left tile of the watered 2x2; the object is drawn on that 2x2's shared corner. |
| `farm_props` | `owner` FK, `source_index`, `asset`, `x`, `y`, `carried` | Unique `(owner, source_index)`. Indices map to the starter prop list. |

All foreign keys cascade on farm delete. `Accounts.reset/0` deletes sessions
then users; `FarmStore.reset/0` deletes tiles, barn items, fences, gates,
sprinklers, props, then farms.

### 7.2 Wire types (`shared/types.ts`)

```ts
export type FarmTileState = "tilled" | "planted" | "watered" | "ready";

export interface FarmTile {
  x: number;
  y: number;
  state: FarmTileState;
  crop?: string;              // "wheat" or "tomato:2" (remaining harvests)
  planted_at?: number | null; // epoch ms
  watered_at?: number | null;
  ready_at?: number | null;
}

export interface ActiveFarm {
  owner: string;
  tiles: FarmTile[];
  tomatoes: number;           // legacy convenience, derived from barn.tomato
  barn: Record<string, number>;
  animals: Record<string, number>;  // livestock by species
  land_level?: number;
  is_public: boolean;         // strangers may join
  visitor_edit: boolean;      // visitors may farm/build/move props
  fences: Array<{ x: number; y: number }>;
  fence_count: number;
  gates: FenceGate[];
  gate_count: number;
  sprinklers: FarmSprinkler[];   // anchored by the 2x2's top-left tile
  sprinkler_count: number;
  prop_overrides: Array<{
    index: number; asset: string; x: number; y: number; carried: boolean;
  }>;
  prop_inventory: Record<string, number>;
}

export type FarmAction = {
  kind:
    | "till" | "plant" | "water" | "harvest"
    | "place_fence" | "remove_fence" | "place_gate" | "remove_gate"
    | "place_sprinkler" | "remove_sprinkler";
  x: number;
  y: number;
  crop?: CropId;                       // plant only
  tool?: "hand" | "scythe";            // harvest only
  comboMutationMultiplier?: number;    // 1 or 1.5
};
```

`FarmSummary` is the lobby shape: `{owner, tiles, planted, watered, ready,
tomatoes, is_public}`. Private farms are filtered out of the dashboard and
train menu, so `is_public` is mostly a guard for stale snapshots.

`FarmGate` is `{x, y, direction: "horizontal" | "vertical", open: boolean}`.

`FarmPropAction` is `{kind: "dig", index}` or
`{kind: "place", asset, x, y}`.

### 7.3 Coordinates, units, and grids

- World size: `MAP_COLUMNS = 18`, `MAP_ROWS = 12`, `TILE_SIZE = 64`,
  `MAP_WIDTH = 1152`, `MAP_HEIGHT = 768`.
- Farm actions are addressed by **map tile coordinates** `(column, row)`, not
  field-local coordinates. The server accepts `x`/`y` in `0..14` for crop
  actions (`Farm.in_bounds?/2`), even though the rendered field is a smaller
  patch around columns 7–11 and rows 6–8.
- Fences/gates use map coordinates with `x in 0..17` and `y in 0..9`; rows
  10–11 are the river/shore.
- `FIELD_GRID` / `worldToFieldTile()` / `fieldTileToWorld()` exist but the live
  action path uses `Math.floor(worldX / TILE_SIZE)` directly. Do not assume
  actions are field-relative.
- Player position is world pixels, anchored bottom-center. `Space` acts on the
  tile under the player (`farmSceneInput.ts`).
- Props are placed on even coordinates and have fixed display widths; the
  server's `FarmProps.@assets` mirrors the order of `props` in
  `src/world/mapData.ts` by `source_index`.

### 7.4 Crop-string encoding

The single `tiles.crop` string carries both the crop and remaining harvests:

- `"wheat"` → wheat, 1 harvest remaining (default)
- `"tomato:2"` → tomato, 2 harvests remaining

Helpers:

- TS: `encodeCrop` / `decodeCrop` in `shared/farm.ts`
- Elixir: `Crops.encode_crop/2` / `Crops.parse_crop/1`

Always use these helpers. Unknown crop ids fall back to `"tomato"`.

---

## 8. Gameplay rules

### 8.1 Crops

The authoritative TS registry is `shared/crops.ts`; the Elixir mirror is
`backend/lib/grange/crops.ex`. Growth stages are ordered oldest → mature and
**stage counts vary by crop** (5, 4, or 3). Never assume five stages.

| Crop | ID | Variant | Stages | Seed | Sell | Harvest tool | Harvests | Regrow stage | Synergy |
| --- | --- | --- | ---: | ---: | ---: | --- | ---: | ---: | --- |
| Wheat | `wheat` | standard | 5 | 2 | 4 | scythe only | 1 | — | pack |
| Lettuce | `lettuce` | standard | 5 | 4 | 7 | hand or scythe | 1 | — | moisture |
| Tomato | `tomato` | standard | 5 | 8 | 5 | hand or scythe | 2 | 2 | space |
| Midas Wheat | `midas_wheat` | rare | 4 | drop only | 10 | scythe only | 1 | — | pack |
| Frost-Crisp Lettuce | `frost_lettuce` | rare | 4 | drop only | 15 | hand or scythe | 1 | — | moisture |
| Sun-Burst Tomato | `sunburst_tomato` | rare | 3 | drop only | 8 | hand or scythe | 3 | 1 | space |

Hand-harvest vs scythe:

- The scythe always swings at a planted tile. The server enforces readiness.
- A **scythe-only** crop clicked with another tool shows a shake and
  `"<Crop> needs a scythe."`.
- **Hand or scythe** crops are picked by hand with any non-scythe tool.
- Each harvest yields **1** produce item (`Farm.harvest_yield/0` is legacy and
  unused).
- Regrowing crops stay on the tile and reset to their `regrowStage`.

### 8.2 Grid synergy

- **Wheat / Midas Wheat — Pack Mentality:** +5% growth speed per adjacent
  growing wheat-family crop, capped at +20%.
- **Lettuce / Frost-Crisp — Moisture Sponge:** while watered/ready, adjacent
  crops retain moisture (`LETTUCE_MOISTURE_DECAY_MULTIPLIER`). Neither the
  server tick nor the client applies it yet (see gaps).
- **Tomato / Sun-Burst — Space-Hungry:** −20% growth if touching another
  tomato-family crop; +15% if touching lettuce.
- Positive synergy for mutation rolls:
  - wheat: ≥2 adjacent growing wheat-family crops
  - lettuce: watered/ready and at least one growing neighbor
  - tomato: no tomato neighbors and ≥1 lettuce neighbor

### 8.3 Combo system

The combo tracker is **client-side** (`src/world/comboTracker.ts` +
`ComboController`). Only a boolean-ish mutation multiplier is sent to the
server.

| Streak | Window | Perk |
| ---: | --- | --- |
| 1–4 | 1.5s (plus a one-time +0.4s on hotbar swap) | Tracks streak; badge appears at 3+ |
| 5–9 | 1.5s | +10% walk speed on farm tiles |
| 10–14 | 1.5s | 15% chance to spread a water/scythe action to one valid orthogonal neighbor |
| 15+ | 1.5s | 1.5× rare mutation seed drop multiplier |

Higher tiers keep lower-tier perks: 15+ still has the speed bonus and the
spread chance. `comboTier` picks one label, but `comboPerks` returns them all.

Tuning lives in `shared/mechanics.ts` (and is mirrored in `Crops` where the
server needs it).

### 8.4 Rare mutation drops

Rolled on a mature **standard** crop harvest:

```
chance = (0.0015 + (synergyActive ? 0.0025 : 0)) * comboMultiplier
```

`comboMultiplier` is `1.5` at combo 15+, else `1.0`. Maximum is `0.006` (0.6%).

- The **server** rolls in `FarmAction.mutation_drops/5`, persists the drop in the
  actor's seed inventory, and returns the item ids in the `farmAction` ack.
- The client does not roll; it reads `drops` from the ack and shows a
  "Rare <name>!" notice.
- Sun-Burst Tomato declares a separate 10% bonus seed (`tomato-seed`) in the
  registry, but nothing rolls it: the server harvest path ignores it and the
  client has no local harvest simulation.

### 8.5 Fences, gates, and props

- Fences and gates are separate tables from crop tiles.
- Owners place them from the hotbar: Gate = slot 5/key `5`, Fence = slot
  6/key `6`, Shovel = slot 7/key `7`.
- Default supply: 20 fences, 2 gates; tracked on `farms.fence_count` /
  `farms.gate_count`.
- Rails are derived from neighboring posts. Placing or removing any post
  re-aims adjacent gates: horizontal neighbor wins, then vertical, then
  horizontal default.
- A closed gate blocks like a fence; an open gate removes only the rail it
  covers. Anyone (including visitors) within 90px can press `E`/`Enter` to
  toggle a gate.
- Shoveling a fence/gate returns it to the owner's supply. Shoveling a movable
  prop puts it in `prop_inventory`.
- Crop tiles cannot be fenced/gated (server-enforced); the client also refuses to
  place one on the player's own tile.
- Movable props: `MOVABLE_PROP_ASSETS` in `src/world/mapData.ts` (buildings,
  trees, furniture, flowers; the train is excluded). Their server-side source
  indices live in `FarmProps.@assets`. **Adding or reordering starter props
  requires updating those indices.**
- Placement uses drag previews and validates terrain/obstacles/collisions.
- **Sprinklers** are a separate `farm_sprinklers` table, bought at the
  hardware-market stall in the marketplace (opened as the "Hardware Store"
  market window; `POST /api/hardware/buy`) and tracked on
  `farms.sprinkler_count`. A sprinkler is anchored by the top-left tile of a
  2x2 and drawn on the corner those four tiles share; it may sit on grass or
  worked (tilled/planted) soil without blocking the tile. While it stands,
  every planted tile in its square is watered on the next `FarmStore.tick/1`
  (via `Grange.FieldWater`), so it keeps its 2x2 saturated until it is
  shoveled up; bare tilled soil in the square is also kept from the till-decay
  sweep (see 8.7). The client mirrors `sprinkler_count` into the hotbar; the placed
  sprite is a static green base plus a brass rotor that spins briefly about once
  a minute with a water spray (`SprinklerLayer`), and it is drawn below the crop
  layer so a mature plant always renders in front of it.
- The hardware store stall also **restocks fences and gates** (they spend the
  farm's supply counts) and sells the basic tools (hoe, watering can, scythe,
  shovel) as one-off purchases. The tools read as "Owned" because the starter
  hotbar already grants them.

### 8.6 Farm visibility and visitor editing

Each farm row carries two flags, both defaulting to off:

- `is_public` — whether strangers may join `farm:<owner>`. Going private only
  blocks **new** joins; anyone already in the room stays until they leave.
- `visitor_edit` — whether visitors may perform farm actions. The server
  re-reads it on every action, so revoking it blocks the next action
  immediately (there is no push that evicts an in-flight request).

The owner opens the `HouseMenu` with `E`/`Enter` within `FARM_HOUSE_REACH` of
the farmhouse and toggles both flags through `updateSettings`.

What visitors may do while `visitor_edit` is on:

- till, plant, water, harvest;
- place/remove fences and gates;
- dig and place movable props.

Regardless of editing, visitors may walk around and toggle gates. Selling
produce, buying livestock, the bank, fishing, and settings are owner-only.

Ownership of the farm state is shared, but seed spending and rare mutation
drops follow the **actor**, while harvested produce goes to the **owner's**
barn. `FarmChannel` authorizes against the persisted flags; the client
`canEditFarm()` helper is only the UI gate.

Private farms are omitted from the dashboard's open-farm list and from the
train destination menu. They are hidden, not shown as locked rows.

### 8.7 Tilled soil reverts to grass

Bare tilled ground does not stay tilled forever. `FarmTick.run/1` (called once a
second by `FarmTicker`) deletes any tile that has sat in the `tilled` state for
`Farm.till_decay_ms/0` (20 minutes) and then broadcasts the farm and lobby, so
the client repaints it as grass.

- Only the bare `tilled` state counts down. Planting or watering moves the tile
  to `planted`/`watered` and clears `tilled_at`, so a planted crop is safe until
  it is harvested.
- A harvest that clears the tile back to bare ground stamps a fresh
  `tilled_at`, restarting the 20-minute window.
- Soil inside a sprinkler's 2x2 is exempt: `FarmTick` skips any covered tile, so
  a sprinkler keeps its tilled ground from ever drying out. Placing or lifting a
  sprinkler restamps the covered tiles' `tilled_at`, so removing one starts a
  fresh 20-minute window instead of reverting on the next tick.
- There is no warning UI: the reversion is silent and the client just receives
  the updated farm. `tilled_at` is server-only and is not sent over the wire.
- The server owns the rule; the client only repaints what `farmUpdate`
  delivers.

---

## 9. Coding conventions

### 9.1 TypeScript / React

- TS is `strict` with `noUnusedLocals` and `noUnusedParameters`; remove unused
  imports/variables or the build fails.
- Target ES2020, bundler module resolution; imports have no file extensions.
- Prefer `import type` for type-only imports.
- React function components; hooks at the top; no class components.
- Keep per-frame work out of React. The Excalibur scene reads Zustand with
  `useGameStore.getState()`; React components subscribe with selectors.
- Use `data-testid` on any element an e2e test may need.
- Tailwind utilities are used for screens/menus; gameplay HUD/overlays use
  dedicated CSS files (`inventory.css`, `farmMap.css`, `marketWindow.css`,
  `poker.css`, etc.).
- Theme colors are defined once in `src/index.css` (`--soil`, `--barn`,
  `--leaf`, `--barn-red`, `--plum`, `--pumpkin`, `--wheat`, `--cream`,
  `--husk`) and exposed as Tailwind utilities. Use those rather than raw hex
  values in new UI.

### 9.2 Zustand

- One store per concern: `useGameStore`, `useInventoryStore`,
  `useNotificationStore`, `usePauseStore`, `useComboStore`.
- Actions live inside the store; components call them via selectors.
- Pure helper functions (like `countItem`, `isInventoryBlockingInput`) can live
  beside the store.
- Do not add a global Redux-style dispatcher.

### 9.3 Excalibur

- Scenes extend `ex.Scene` or `WalkingScene`.
- Register new scenes in `FarmMap.tsx`; add image sources to `resources.ts` (or
  the scene-specific resource module) and to that scene's group in
  `worldAssets.ts`, or the image renders blank on the first visit.
- Use `TILE_SIZE`/`MAP_*` constants; do not hard-code 64/1152/768.
- Use `BlockRegistry`, `walkCollisions`, and `sceneObstacles` instead of ad-hoc
  collision checks.
- Preserve `data-world-ready="true"`, the canvas `aria-label`
  (`"Farm map..."` / `"Marketplace map..."` / `"Casino map..."`), and
  `data-testid` values; e2e depends on them.
- Freeze the scene and hide/freeze the player while a DOM overlay owns input.
- Load order matters: the boot scene's images (`ensureSceneResources`) →
  `engine.start()` → `goToScene`. The rest preload behind the first frame.
- Drive movement, collision steps, and train animation with `FrameClock`
  (`src/world/frameClock.ts`), not the `delta` argument. Excalibur replaces any
  frame longer than 200ms with 1ms, which puts the world into slow motion on a
  loaded machine; `FrameClock` reports the real wall-clock step (capped at
  100ms) and is identical to `delta` at normal frame rates.

### 9.4 Elixir

- Run `mix format` (the formatter wraps at its default 98 columns); Credo's
  `MaxLineLength` check allows up to 120.
- Every module needs a `@moduledoc` (Credo strict).
- Keep pure rules (`Farm`, `Crops`, `FarmAction`) separate from persistence
  (`FarmStore`, `Barn`, `FarmFences`, `FarmGates`, `FarmProps`).
- Use `Repo.transaction/1` for multi-row mutations.
- Normalizers accept both string and atom keys (`Map.get(map, key) ||
  Map.get(map, String.to_atom(key))`); preserve that tolerance.
- User-facing errors are short lowercase strings (e.g. `"tile is not ready"`,
  `"no tilled tile here"`). The SPA displays them in the notification feed.
- Avoid `Process.sleep` in tests; the custom Credo check rejects it. Drive
  `FarmStore.tick/1` directly instead.
- Elixir file-size check: `Grange.Credo.Check.SourceFileMaxLines` enforces
  300 code lines / 500 total lines.

### 9.5 File-size strategy

When a file nears the cap, extract one coherent concern:

- Scene helpers → `farmSceneTiles.ts`, `farmSceneInput.ts`, `farmActionRunner.ts`
- Obstacles → `sceneObstacles.ts`, `walkCollisions.ts`
- Rendering → `cropLayer.ts`, `fenceRendering.ts`, `propLayer.ts`
- Data → `*Data.ts`, `*Resources.ts`
- Pure rules → `farmActions.ts`, `farmActionRunner.ts`

Do not add `biome-ignore` comments to dodge lint unless there is a documented
reason (the repo already has one for a deliberate hook dependency).

---

## 10. Testing

### 10.1 Unit tests (Vitest)

- Files are colocated: `src/**/*.test.ts` or `.test.tsx`.
- Environment is **node** (no jsdom installed). Test pure logic and stores,
  not DOM rendering, unless you add a jsdom setup deliberately.
- `pnpm test` runs everything with `--passWithNoTests`.
- Tests should be deterministic: inject RNG (`rng: () => number`) or use seeded
  helpers where the code supports it. Casino modules accept rigged decks/RNG.

### 10.2 Backend tests (ExUnit)

- Located under `backend/test/`.
- `test_helper.exs` only calls `ExUnit.start()`; there is no Ecto sandbox.
- Tests use the real SQLite test database `backend/priv/grange_test.sqlite3`.
- In `setup`, call `Accounts.reset()` and/or `FarmStore.reset()` to start clean.
  Keep tests `async: false` when they touch global state; pure modules can be
  `async: true`.
- `GrangeWeb.ChannelCase` provides `register_user/1` and imports
  `Phoenix.ChannelTest`.
- `Grange.FarmFixtures` (`backend/test/support/farm_fixtures.ex`) is the
  shared setup helper: `reset_farm_state/0`, `full_farm/1`, `public_farm/1`,
  `editable_farm/1`, `set_farm!/2`, `tile_at/3`, `grow/3`. Prefer it over
  hand-rolled `FarmStore` calls so the tests keep their shape.
- Tests call `FarmStore.tick/1` directly; the ticker is disabled in test
  config.

### 10.3 E2E (Playwright)

- Specs live in `e2e/`; shared helpers in `e2e/helpers.ts`, which re-exports
  the implementation from `e2e/support/` (`auth`, `nav`, `farm`, `peers`,
  `players`) so the modules stay under the file-size cap.
- Accounts are wiped once per run by `e2e/global-setup.ts` (`POST /api/reset`).
  Tests do **not** reset the server themselves: they register a unique account
  (`uniqueName`) instead, which is what lets the suite run in parallel.
- Use `registerFast` (auth API + `goto`) unless the test is about the login
  form itself; only `auth.spec.ts` drives the UI registration flow
  (`registerAccount` / `register`).
- **Deep-link into the scene under test.** `registerFast(page, name, { area:
  "casino" })` boots `/world?area=casino` instead of walking there. The real
  navigation loop is covered once, in `journey.spec.ts`; feature specs should
  not pay for a farm → marketplace → casino walk. Valid areas are
  `farm-map`, `marketplace`, `casino`, `livestock-market`, `bank`
  (`requestedStartArea()` in `src/world/testMode.ts`).
- The hooks are gated to dev/test: `PageController` injects
  `<meta name="grange-test-routes" content="true">` only when
  `enable_test_routes` is on (the same flag as `/api/reset`), and
  `testMode.ts` reads it. Production never injects it, so `?area=` is ignored
  and walking speed is normal.
- `webServer.env` in `playwright.config.ts` runs the suite on a fast clock,
  all of it e2e-only:
  - `GRANGE_GROW_MS=100` → `Farm.grow_ms/0`: a crop ripens in 100ms, not 10s.
  - `GRANGE_TICK_MS=100` → the `FarmTicker` sweep interval, so a watered crop is
    ready on the next sweep instead of the next second.
  - `GRANGE_FAST_HASH=1` → the cheap Argon2 parameters `test.exs` uses. The
    suite registers ~50 accounts, and production hashing is a measurable slice
    of that.
  - The test-mode `WALK_SPEED_MULTIPLIER` (in `testMode.ts`) is **3x**, so a
    `holdKeys` leg covers three times the ground.
  - Wall-clock animations use `e2eMs(real, fast)` from `testMode.ts`: train
    travel 2s → 500ms, roulette spin 4.2s → 1s, slots spin 1.8s → 500ms,
    auto-spin delay 900ms → 200ms. Do not assert transient "spinning" copy:
    the shortened animation can settle before Playwright reads it, and the
    settled result is the assertion that matters.
- `waitForWorld` waits for the canvas and `[data-world-ready="true"]`. Do not
  add `waitForLoadState("networkidle")` — it is slower and redundant. The flag
  needs `engineReady`, the joined farm snapshot, and (on your own farm) the
  hydrated inventory; the engine reports ready as soon as its first scene is
  active, so a world that boots into a hub is ready too.
- Tile interactions use `clickFarmTile` / `hoverFarmTile`, which map tile
  coordinates to page pixels using `MAP_COLUMNS`/`MAP_ROWS`.
- Walking tests use `walkUntilPrompt` and the `travel-prompt` testid. Use
  `holdKeys` only for short geometry legs between prompts, never as a
  stand-in for "walk until the prompt appears".
- `walkUntilPrompt` polls every 40ms and releases the movement keys *inside*
  the page as soon as the prompt matches. Do not "improve" that back into a
  release over the wire: the canvas runs at a few frames per second on a loaded
  runner, so a late release walks the player out of neighbouring interaction
  radii (the casino's poker and slot radii overlap). Both helpers also re-send
  their keydown while they hold, because a keydown delivered while a scene is
  still paused after a DOM overlay closes is dropped.
- Boarding is two steps: the prompt reads `board the train`, then `rideTrain(page,
  destinationId)` presses `E` and clicks `travel-option-<id>` (`marketplace`,
  `home`, `farm-<owner>`).
- Trains, overlays, and hub easing still cost real time on a busy runner, so
  scene-change assertions after a ride use `TRAVEL_TIMEOUT` (30s) instead of
  Playwright's 5s default.
- Multiplayer tests use the `twoPlayers` fixture (`multiplayerTest as test`) —
  it creates two isolated contexts and always closes them, including on
  failure. `waitForHubPeer`/`waitForHubPeerGone` read `data-hub-peers`;
  `waitForFarmPeer`/`waitForFarmPeerGone` read `data-farm-peers`; the house
  menu uses `house-menu` / `house-visibility-toggle` / `house-edit-toggle`.
- One spec file per feature, not per overlay: `casino.spec.ts` is four
  deep-linked tests (one per table), not four files that each re-walk the
  world.
- e2e runs against the **built** SPA served by Phoenix on port 3201, not Vite.
- `pnpm test:e2e` runs `vite build` first. If you changed frontend code, do not
  run Playwright without rebuilding.
- The suite runs `fullyParallel` with **2 workers by default**
  (`workers: Number(process.env.E2E_WORKERS ?? 2)`); CI sets `E2E_WORKERS=3`
  because the runner has 4 vCPUs. A faster local machine started at its own core
  count just saturates the CPU and makes every walk slower than it is with two;
  raise `E2E_WORKERS` to experiment. The per-test timeout is 90s (the longest
  paths, like the casino, set their own larger budget).

### 10.4 CI

`.github/workflows/ci.yml` has a single required `test` job:

1. Set up Erlang/Elixir, pnpm, Node.
2. Install JS and Elixir deps.
3. `pnpm lint:backend`
4. Install Chromium.
5. `pnpm check` (lint, Vitest, ExUnit, build).
6. `pnpm test:e2e:run` (Playwright only). `pnpm check` already ran `pnpm build`,
   so the e2e step must not rebuild; CI also sets `E2E_WORKERS=3`.

The required status check name is **`test`**; renaming the job silently
removes the required check from the ruleset. There is also a `secrets` job that
runs Gitleaks.

---

## 11. Cookbook

### 11.1 Add a crop

1. Add the id to `CropId` and a full entry to `CROPS` in `shared/crops.ts`
   (stage filenames, harvested sprite, seed id, costs, harvest tool, harvests,
   regrow stage, synergy, mutation/bonus fields).
2. Add the matching stage list and entry to `@crops` in
   `backend/lib/grange/crops.ex`. Keep names, costs, tools, harvest counts, and
   synergy identical.
3. Add stage + harvested art to `public/assets/crops/` using the exact
   filenames. `resources.ts` derives image sources from `CROPS`.
4. Add seed/produce items in `src/inventory/items.ts`:
   - `ItemId` union
   - `ITEMS` entry
   - `SEED_CROPS` (seed → crop)
   - `CROP_ITEMS` (crop → produce item)
5. Add market entries in `src/world/marketData.ts` (`MarketItemId`,
   `MARKET_ITEMS`, and `MARKET_CATEGORIES.seeds` or `.sell`) and the seed
   mapping in `src/world/useFarmMarket.ts` (`SEED_ITEMS`).
6. Update `notes/farming-mechanics.md` and the crop table in this file.
7. Add/extend tests in `backend/test/grange/crops_test.exs` and relevant
   `src/world/*.test.ts`. Consider an e2e case for the full grow loop.
8. Check whether `src/world/farmActions.ts` needs a crop-specific branch (most
   behavior is registry-driven).

### 11.2 Add an inventory item

1. Add the id to the `ItemId` union and `ITEMS` in `src/inventory/items.ts`
   (name, kind, max stack, icon, description).
2. Map it if it is a seed (`SEED_CROPS`) or produce (`CROP_ITEMS`).
3. Map it if it is a tool (`farmToolForItem`).
4. Decide whether it belongs in `buildInitialHotbar` or is admin-granted.
   `buildAdminHotbar` iterates `Object.keys(ITEMS)`, so admin inventory updates
   automatically.
5. Add an icon under `public/assets/` and reference it with `/assets/...`.
6. If it is a placeable building, add it to `PropKey`,
   `MOVABLE_PROP_ASSETS`, `propBlocking`, `props`, `propImages`,
   `farmPlacementFootprints`, and (if it has a fixed source index) the server's
   `FarmProps.@assets`.
7. Add tests for stacking/removal/mapping as needed.

### 11.3 Add a farm action

1. Add the kind to `FarmAction["kind"]` in `shared/types.ts`.
2. If it is a tool action, map it in `TOOL_KIND` / `resolveAction`
   (`src/world/farmActions.ts`).
3. Dispatch it from `performFarmAction` or the appropriate scene handler.
4. Add the string→atom entry to `@kinds` and a `mutate/5` clause in
   `backend/lib/grange/farm_store.ex`.
5. Add bounds handling for the new kind in `run/5`.
6. Ensure `FarmStore` broadcasts through `refresh/1` or `apply_action/5`.
7. Add ExUnit coverage (channel + store) and Vitest coverage for the pure
   resolver.
8. Visitors must not be able to invoke owner-only actions; authorization lives
   in `FarmChannel.authorize/2`.

### 11.4 Add a channel event

1. Add `handle_in/3` to `backend/lib/grange_web/channels/farm_channel.ex`
   (or `lobby_channel.ex`).
2. Authorize using `socket.assigns[:user]` and `socket.assigns[:owner]`; never
   accept a username from the payload.
3. Broadcast with `GrangeWeb.Endpoint.broadcast(topic, event, payload)` via
   `FarmStore.refresh/1` or a dedicated helper.
4. Add a typed wrapper in `src/socket.ts` (`emit...`), with `ok`/`error`/
   `timeout` handling.
5. Update `useGameStore`/the relevant store when the pushed event arrives.
6. Add an ExUnit channel test and, if it is user-visible, an e2e test.

### 11.5 Add a persistence field

1. Create a new migration in `backend/priv/repo/migrations/` with a later
   timestamp. Do not edit existing migrations.
2. Add the field to the Ecto schema.
3. Include it in the relevant changeset/transaction and in the `view` map.
4. Add it to the TS wire type in `shared/types.ts` (or `shared/auth.ts`).
5. Consume it in the client; keep the old shape working if other code relies on
   it.
6. Test the migration path by booting the app (migrations auto-run) and with a
   focused ExUnit test.

### 11.6 Add or change a world scene / destination

1. Extend `WalkingScene` for a standard walkable area, or `ex.Scene` if it needs
   custom behavior.
2. Add a `*Data.ts` module for terrain, props, spawn points, and entrances.
3. Add a `*Resources.ts` module with its image sources, then add the scene to
   `WorldSceneName` and to `sceneAssets` in `worldAssets.ts`. A scene that is
   not in `sceneAssets` cannot boot or be travelled to safely.
4. Define walk obstacles in `sceneObstacles.ts` using `propObstacles`.
5. Register the scene with `engine.addScene(...)` in `src/world/FarmMap.tsx`.
6. Add a `SceneInteraction` with `destination` and `destinationSpawn`; extend
   `WorldSceneName` if the destination is new.
7. Update travel prompts and the canvas `aria-label` (e2e checks both).
8. Add a `waitFor...`/walk helper in `e2e/helpers.ts` if the path is tested.

### 11.7 Add a market item

1. Extend `MarketItemId`, `MARKET_ITEMS`, and the appropriate
   `MARKET_CATEGORIES[*].items` in `src/world/marketData.ts`.
2. For a seed, add `SEED_ITEMS` in `useFarmMarket.ts` and an inventory item.
3. For produce, ensure it exists in `CROP_ITEMS` and the barn can hold it.
4. The market UI (`MarketWindow`) renders from these maps; no JSX changes are
   normally needed.
5. Add a test for price/quantity/disabled logic if behavior changes.

### 11.8 Add or change a casino game

- Pure game rules live in `blackjack.ts`/`blackjackGame.ts`,
  `poker*.ts`, `roulette*.ts`, `slots*.ts`.
- React overlays live in the matching `*Overlay.tsx`.
- Wallet transfers go through `EconomyManager.withdrawChips` /
  `depositChips` so balance changes sync to the account.
- Keep RNG/deck injection for deterministic tests.
- Add `data-testid` to any new controls; e2e specs exist for all four games.

---

## 12. Invariants and gotchas

1. **`shared/` is not importable by Elixir.** It is shared by the SPA and
   tests only. Duplicate server rules in `backend/lib/grange/crops.ex` and
   `farm_action.ex`.
2. **Two different `FarmTile` types share a name.** `shared/types.ts` describes
   the wire tile (`crop?: string`); `shared/farm.ts` describes the local
   simulation tile (`cropId: CropId`). Import the right one.
3. **The farm is server-authoritative.** Do not update tiles, barn counts, or
   fence state optimistically. Emit an action and wait for `farmUpdate`.
4. **`farmUpdate` sends the whole farm.** No deltas; replace the store value.
5. **Coordinates are map tiles, not field tiles.** See section 7.3.
6. **Fence/gate bounds are not farm bounds.** Fences/gates allow
   `x 0..17, y 0..9`; crops allow `0..14` in both axes.
7. **Stage counts vary.** Use `stageCount()` / `Crops.stage_count/1`; never
   hard-code 5.
8. **`farms.tomatoes` is legacy.** Harvests write `barn_items`; `view.tomatoes`
   is derived from `barn["tomato"]`. Do not add new writes to the column.
9. **Rare mutation seeds are server-rolled.** `FarmStore` persists drops in the
   actor's inventory and returns them in the `farmAction` ack; the client only
   displays them. Do not re-add a client-side roll.
10. **The combo tracker is client-only.** The server receives only
    `comboMutationMultiplier` (1 or 1.5) and maps it to combo count 15 for the
    drop formula.
11. **Passive watering / moisture retention is not modeled at all.** `Crops`
    exposes `passive_water` and the client registry exposes the decay
    multiplier, but `FarmStore` does not water neighbors on a tick and the
    client does not simulate growth. Do not assume either side applies it.
12. **`FarmStore` is not a GenServer.** It is a plain module using Ecto. Only
    `FarmTicker` is a GenServer.
13. **SQLite is single-writer.** Dev/test use `pool_size: 1`; prod defaults to
    1. Batching and transactions matter. The app assumes a single node.
14. **Timestamps are wall-clock epoch milliseconds** (`System.system_time/1`),
    not `DateTime`, for tile deadlines. Sessions use `DateTime` in the DB.
15. **Migrations run on boot.** Adding a migration is enough for dev/test/prod;
    do not add a separate release migrate step.
16. **`/api/reset` only exists in dev/test** (`enable_test_routes`). E2E boots
    with `MIX_ENV=dev`.
17. **The ticker is off in tests** (`start_ticker: false`). Call
    `FarmStore.tick/1` explicitly.
18. **The SPA must be built before e2e.** Phoenix serves
    `backend/priv/static/index.html`; `pnpm test:e2e` builds first.
19. **`vite preview` intentionally mirrors the dev proxy.** Keep both proxy
    blocks in `vite.config.ts` in sync.
20. **Admin inventory is client-side.** `is_admin` only triggers
    `grantAllItems()` on sign-in. There is no server-side item authorization.
21. **The server trusts balance deltas.** `POST /api/economy/transaction`
    accepts any integer delta from a logged-in user. Do not treat it as a
    secure economy authority.
22. **Moving props are indexed by source order.** `FarmProps.@assets` must
    match `props` in `mapData.ts`. Reordering props without updating both
    corrupts dig/place behavior.
23. **Assets are loaded through `ImageSource`, one scene at a time.** Add new
    images to the relevant resource array *and* to that scene's group in
    `worldAssets.ts`, or they render blank. Paths are relative to `/assets/`.
24. **Keep e2e testids stable.** Renaming `farm-tile`, `travel-prompt`,
    `slot-hotbar-N`, `farm-balance`, etc. breaks tests.
25. **`shared/auth.ts` has unused-looking fields.** `User.createdAt` is never
    sent by the backend (the server sends `inserted_at`), and `passwordHash` is
    server-only. Use `AuthUser` fields that actually exist.
26. **`Farm.harvest_yield/0` is unused.** Harvests add 1 produce item.
27. **Do not edit `backend/priv/static`** — it is generated by `vite build` and
    gitignored.
28. **`repo-sanity` only sees committed files.** A new junk file can pass a
    local run until staged; still keep the tree clean.
29. **The server spends seeds before acking.** `performFarmAction` emits the
    action without mutating local seeds, then `hydrateSeeds(res.seeds)` applies
    the authoritative counts from the ack. A rejected action never eats a seed.
30. **Hub presence is ephemeral and cosmetic.** Marketplace/casino players are
    tracked in memory by `GrangeWeb.Presence` (no table, no migration) and their
    positions are clamped, not simulated. Never trust a hub position for
    gameplay decisions.
31. **Farms are not hubs.** `FarmMapScene` does not extend `WalkingScene` and
    must never join `hub:*`; only scenes that pass `hubArea` are multiplayer.
32. **One avatar per account.** Hub presence is keyed by username; a second tab
    adds another meta, and the client renders only the newest `at`. Don't switch
    to a per-socket key without updating `hubClient.readPeers`.
33. **Remote avatars are visual only.** They are not in `walkCollisions` or
    `sceneObstacles`; players walk through each other by design. Their sprites
    and name labels use `depthForY(y)` from `src/world/depth.ts`, the same
    `100 + floor(y)` band as props, so a player below a building draws in front
    of it and a player above draws behind it.
34. **Farm settings default to private and read-only.** New and existing farms
    get `is_public: false` and `visitor_edit: false`; the migration backfills
    both flags.
35. **Farm presence lives on `farm:<owner>`.** There is no separate farm-presence
    channel or table. It uses the same `GrangeWeb.Presence` tracker and the same
    username-keyed metas as hubs, so one account still renders one avatar.
36. **Visibility and editing are different gates.** `is_public` only controls
    new joins; `visitor_edit` controls actions and is re-read per action.
    Turning a farm private never disconnects current visitors.
37. **Visitor actions are actor-aware.** Seeds and mutation drops belong to the
    acting user; harvested produce belongs to the farm owner. Do not collapse
    actor and owner when adding a new action.
38. **Never use Excalibur's `delta` for gameplay timing.** The engine clock
    rewrites any frame longer than 200ms to 1ms, so a starved browser plays in
    slow motion (a 2s train ride or a walk across the farm can take minutes).
    `FrameClock` from `src/world/frameClock.ts` reports the real wall-clock step
    capped at 100ms and is identical to `delta` at normal frame rates. Take one
    step per `onPreUpdate` and pass it down; do not call `step()` twice in a
    frame.

---

## 13. Definition of done

Before finishing a change, verify:

- [ ] `pnpm lint` passes (Biome, file sizes, repo sanity).
- [ ] `pnpm test` passes (Vitest).
- [ ] `pnpm test:backend` passes (ExUnit).
- [ ] `pnpm build` passes (`tsc` + Vite).
- [ ] `pnpm lint:backend` passes (format + Credo strict) if backend changed.
- [ ] `pnpm test:e2e` passes if the change affects UI, routing, canvas, HUD,
      inventory, markets, casino, auth, or the farm action path.
- [ ] Crop/mechanic constants are mirrored in TS and Elixir.
- [ ] New wire fields are added to both the Elixir `view` and the TS types.
- [ ] New UI has stable `data-testid` values.
- [ ] No `.env`, SQLite, build output, or generated files are staged.
- [ ] This file or the relevant `notes/` doc is updated if behavior changed.

---

## 14. Known gaps and inconsistencies

These are current realities, not necessarily desired behavior. Do not “fix”
them silently as part of an unrelated change; mention them in the PR.

- Settings, whitelist management, and some market tabs (`tools`, `train`) are
  stubs.
- Rare mutation seeds are persisted server-side, but Sun-Burst Tomato's extra
  10% seed is declared and never rolled.
- Server-side passive watering for Frost-Crisp Lettuce is not implemented, and
  nothing else models it either (the old client-local simulation is gone).
- Server growth calculation does not include lettuce moisture retention; the
  registry constant exists but no code path applies it.
- `FarmStore` uses direct Ecto reads/writes; `notes/sqlite-plan.md`’s
  write-behind cache design is outdated.
- `farms.tomatoes` remains for compatibility and is read by the dashboard and
  farm HUD.
- `Farm.harvest_yield/0` is a dead constant.
- `User.createdAt` in `shared/auth.ts` does not match the server payload.
- The economy trusts client-supplied deltas; it is a game, not a ledger.
- Casino games are entirely client-side; only the resulting wallet delta is
  synced.
- The farm’s rendered field is a small patch, but the server accepts a 15×15
  action area.
- Hub avatars do not collide with each other or with the local player.
- Hub movement is sent at ~10 Hz and eased client-side, so remote players can
  appear slightly behind their true position; there is no interpolation buffer
  or lag compensation.
- Hub presence is per area: a player in the casino is invisible to players in
  the marketplace, and players on their farms are in no hub at all.
- Farm presence is cosmetic only: no collision, chat, emotes, or persistence.
- A private farm can still be reached by someone already inside; there is no
  kick and no in-place reconnect, and the client keeps the old snapshot.
- Turning `visitor_edit` off blocks the next action but does not cancel one
  already inside `FarmStore.action/3`.
- The dashboard and train menu filter on the last lobby snapshot, so a farm that
  flips private can linger in an open tab until the next `farms` push.

---

## 15. Further reading

- `README.md` — setup, database location, tests, deploy.
- `notes/farming-mechanics.md` — crop/mechanic reference and asset mapping.
- `notes/hub-multiplayer.md` — hub channel, presence, rendering, tuning.
- `notes/farm-multiplayer.md` — farm settings, visitor rules, farm presence.
- `notes/change-policy.md` — branch/PR/review policy.
- `notes/WireFrameLayout.md` — HUD/menu/inventory layout intent.
- `notes/GameDesignNotes.md` — high-level game direction.
- `notes/sqlite-plan.md` — historical persistence design (not current code).
- `deploy/` — systemd unit, env, deploy script.
- `.github/workflows/ci.yml` — exactly what CI runs.
