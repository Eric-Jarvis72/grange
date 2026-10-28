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
- Visit other players' farms read-only; visitors can open and close gates.
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
pnpm exec vitest run src/world/farmState.test.ts
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
| GET | `/api/state` | none | `{playerCount, farmCount}` |
| POST | `/api/reset` | none | Dev/test only; wipes accounts and farms |

Unmatched `/api/*` routes return JSON 404 before the SPA fallback. Every other
path serves the built `index.html`.

### 5.6 Phoenix Channels protocol

The SPA uses one shared socket and two channels:

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

Join reply: `{ "farm": <ActiveFarm> }`. The farm must exist; the joining
owner's own farm is created on demand (`FarmStore.ensure/1`).

Server pushes `farmUpdate` → `{ "farm": <ActiveFarm> }` after every successful
change. There is **no partial/delta update**: the client replaces the whole
active farm.

Client events:

| Event | Payload | Allowed caller | Success | Error |
| --- | --- | --- | --- | --- |
| `farmAction` | `{action: FarmAction}` | farm owner only | `:ok` | `{error: reason}` |
| `gateAction` | `{action: {kind: "toggle_gate", x, y}}` | any logged-in user | `:ok` | `{error: reason}` |
| `farmPropAction` | `{action: {kind: "dig", index} \| {kind: "place", asset, x, y}}` | farm owner only | `:ok` | `{error: reason}` |
| `sellProduce` | `{item: cropId, count: integer}` | farm owner only | `:ok` | `{error: reason}` |

Phoenix error replies are `{:reply, {:error, %{error: reason}}, socket}`.
On the client, `reasonOf()` in `src/socket.ts` reads `error` or `reason` from
the reply payload.

Authorization rules (`FarmChannel`):

- Unauthenticated sockets may join `lobby` but cannot perform farm actions.
- Farm actions require `socket.assigns.user.username == socket.assigns.owner`.
- Visitors may join any existing farm read-only.
- Visitors may toggle gates but cannot place/remove fences or gates.
- Prop actions and produce sales are owner-only.

### 5.7 Farm action round trip

1. Hotbar selection determines the held `ItemId` (`src/inventory/inventoryStore.ts`).
2. `farmToolForItem()` maps it to `hoe | seed | bucket | scythe` or `null`.
3. `resolveAction()` (`src/world/farmActions.ts`) decides the intent
   (`till`, `plant`, `water`, `harvest`) from the held tool and the current
   server tile.
4. `performFarmAction()` (`src/world/farmActionRunner.ts`):
   - consumes one seed locally for `plant`,
   - records the combo (`ComboController`),
   - plays the scythe sweep FX,
   - possibly emits a combo-spread action to an orthogonal neighbor,
   - emits `farmAction` with `{kind, x, y, crop?, tool?, comboMutationMultiplier?}`.
5. `FarmChannel.handle_in("farmAction", ...)` authorizes, then calls
   `FarmStore.action(owner, action)`.
6. `FarmStore` normalizes the action, runs it in an Ecto transaction, persists
   the change, and broadcasts `farmUpdate` + lobby `farms`.
7. `src/socket.ts` receives `farmUpdate`, calls
   `useGameStore.setActiveFarm(farm)`.
8. `FarmMapScene.onPreUpdate` calls `FarmTileSync.sync()` and repaints only
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
`activeFarm` (`data-world-ready="true"` requires it). Resources are loaded
before `engine.start()`, and the scene waits for store updates rather than
gating engine construction.

DOM overlays (inventory, pause menu, market window, casino game overlays) pause
the active scene via `scene.setPaused(true)` and/or
`isInventoryBlockingInput()` so movement and tool input are frozen.

The train (`TrainController`) animates departures/arrivals and gates boarding.
Travel destinations and spawn points live in `mapData.ts`,
`marketplaceData.ts`, and `casinoData.ts`.

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
│       ├── mapData.ts         ← terrain/props/grid/spawn constants
│       ├── marketplaceData.ts / casinoData.ts
│       ├── farmState.ts       ← client-local farm simulation (tests/local)
│       ├── farmActions.ts     ← pure action resolution + synergy + drops
│       ├── farmActionRunner.ts← emit farming actions + combo/sweep
│       ├── combo* / farmCombo ← combo tracker/controller/store/HUD
│       ├── tileSync / farmSceneTiles / cropLayer
│       ├── fence* / gateInteraction / blocking
│       ├── farmProp* / propLayer / placement previews
│       ├── marketData / useFarmMarket / MarketWindow
│       ├── blackjack*, poker*, roulette*, slots* ← client-side casino games
│       ├── resources.ts / *Resources.ts ← Excalibur image loading
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
│   │   ├── farm.ex            ← pure tile state machine + bounds
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
│   │   ├── channels/{lobby,farm}_channel.ex
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
| `farms` | `owner` string PK (username), `tomatoes` legacy integer, `fence_count` default 20, `gate_count` default 2, timestamps | Owner is the **username**, not `users.id`. |
| `tiles` | `id`, `owner` FK → `farms.owner`, `x`, `y`, `state` string, `crop` string, `planted_at`/`watered_at`/`ready_at` integer ms | Unique `(owner, x, y)`. `state` is one of `tilled`, `planted`, `watered`, `ready`. |
| `barn_items` | `owner` FK, `item`, `count` | Unique `(owner, item)`. `item` is a crop id. |
| `farm_fences` | `owner` FK, `x`, `y` | Unique `(owner, x, y)`. |
| `farm_gates` | `owner` FK, `x`, `y`, `direction`, `open` | Unique `(owner, x, y)`. `direction` is `horizontal` or `vertical`. |
| `farm_props` | `owner` FK, `source_index`, `asset`, `x`, `y`, `carried` | Unique `(owner, source_index)`. Indices map to the starter prop list. |

All foreign keys cascade on farm delete. `Accounts.reset/0` deletes sessions
then users; `FarmStore.reset/0` deletes tiles, barn items, fences, gates,
props, then farms.

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
  fences: Array<{ x: number; y: number }>;
  fence_count: number;
  gates: FenceGate[];
  gate_count: number;
  prop_overrides: Array<{
    index: number; asset: string; x: number; y: number; carried: boolean;
  }>;
  prop_inventory: Record<string, number>;
}

export type FarmAction = {
  kind:
    | "till" | "plant" | "water" | "harvest"
    | "place_fence" | "remove_fence" | "place_gate" | "remove_gate";
  x: number;
  y: number;
  crop?: CropId;                       // plant only
  tool?: "hand" | "scythe";            // harvest only
  comboMutationMultiplier?: number;    // 1 or 1.5
};
```

`FarmSummary` is the lobby shape: `{owner, tiles, planted, watered, ready,
tomatoes}`.

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
- Each harvest yields **1** produce item (`FARM_HARVEST_YIELD` and
  `Farm.harvest_yield/0` are legacy and unused).
- Regrowing crops stay on the tile and reset to their `regrowStage`.

### 8.2 Grid synergy

- **Wheat / Midas Wheat — Pack Mentality:** +5% growth speed per adjacent
  growing wheat-family crop, capped at +20%.
- **Lettuce / Frost-Crisp — Moisture Sponge:** while watered/ready, adjacent
  crops retain moisture; client simulation applies a 25% slower decay
  (`LETTUCE_MOISTURE_DECAY_MULTIPLIER`). The server only models the growth
  multiplier for wheat/tomato (see gaps).
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

- The client rolls in `ComboController.rollRareSeed` and adds the seed to local
  inventory immediately.
- The server rolls in `FarmAction.mutation_drops/5` and puts `drops` on the
  returned farm map, but the channel ignores that return value. Rare seeds are
  therefore **not persisted server-side** yet.
- Sun-Burst Tomato declares a separate 10% bonus seed (`tomato-seed`) in the
  registry. The client-local simulation (`LocalFarmStore.harvestCrop`) rolls
  it, but the live server harvest path does **not**; treat it like the rare
  mutation drop until the server persists drops.

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
- Register new scenes and resources in `FarmMap.tsx`; add image sources to
  `resources.ts` (or the scene-specific resource module) **before**
  `engine.start()`.
- Use `TILE_SIZE`/`MAP_*` constants; do not hard-code 64/1152/768.
- Use `BlockRegistry`, `walkCollisions`, and `sceneObstacles` instead of ad-hoc
  collision checks.
- Preserve `data-world-ready="true"`, the canvas `aria-label`
  (`"Farm map..."` / `"Marketplace map..."` / `"Casino map..."`), and
  `data-testid` values; e2e depends on them.
- Freeze the scene and hide/freeze the player while a DOM overlay owns input.
- Load order matters: resources → `engine.start()` → `goToScene`.

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
- Pure rules → `farmActions.ts`, `farmState.ts`

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
- Tests call `FarmStore.tick/1` directly; the ticker is disabled in test
  config.

### 10.3 E2E (Playwright)

- Specs live in `e2e/`; shared helpers in `e2e/helpers.ts`.
- Every test starts with `resetServer()` (`POST /api/reset`) and registers a
  unique account (`uniqueName`).
- `registerAccount` leaves the page on the main menu; `register`/`enterFarm`
  continue into `/world`.
- `waitForWorld` waits for the canvas and `[data-world-ready="true"]`.
- Tile interactions use `clickFarmTile` / `hoverFarmTile`, which map tile
  coordinates to page pixels using `MAP_COLUMNS`/`MAP_ROWS`.
- Walking tests use `walkUntilPrompt` and the `travel-prompt` testid.
- e2e runs against the **built** SPA served by Phoenix on port 3201, not Vite.
- `pnpm test:e2e` runs `vite build` first. If you changed frontend code, do not
  run Playwright without rebuilding.
- Tests are serial (`workers: 1`), with a 60s per-test timeout.

### 10.4 CI

`.github/workflows/ci.yml` has a single required `test` job:

1. Set up Erlang/Elixir, pnpm, Node.
2. Install JS and Elixir deps.
3. `pnpm lint:backend`
4. Install Chromium.
5. `pnpm check` (lint, Vitest, ExUnit, build).
6. `pnpm test:e2e`.

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
8. Check whether `src/world/farmState.ts` or `farmActions.ts` needs a
   crop-specific branch (most behavior is registry-driven).

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
3. Add a `*Resources.ts` module and register images in the world's resource
   list (or `resources.ts`).
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
9. **Rare mutation seeds are client-only right now.** The server rolls them but
   the channel discards the returned `drops`; the client persists them in the
   browser inventory only.
10. **The combo tracker is client-only.** The server receives only
    `comboMutationMultiplier` (1 or 1.5) and maps it to combo count 15 for the
    drop formula.
11. **Passive watering / moisture retention is only fully modeled client-side.**
    `Crops` exposes `passive_water` and the client simulation applies it, but
    `FarmStore` does not yet water neighbors on a tick. Do not assume the
    server will do it.
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
23. **Assets are loaded through `ImageSource`.** Add new images to the relevant
    resource array or they render blank. Paths are relative to `/assets/`.
24. **Keep e2e testids stable.** Renaming `farm-tile`, `travel-prompt`,
    `slot-hotbar-N`, `farm-balance`, etc. breaks tests.
25. **`shared/auth.ts` has unused-looking fields.** `User.createdAt` is never
    sent by the backend (the server sends `inserted_at`), and `passwordHash` is
    server-only. Use `AuthUser` fields that actually exist.
26. **`FARM_HARVEST_YIELD` / `Farm.harvest_yield/0` are unused.** Harvests add
    1 produce item.
27. **Do not edit `backend/priv/static`** — it is generated by `vite build` and
    gitignored.
28. **`repo-sanity` only sees committed files.** A new junk file can pass a
    local run until staged; still keep the tree clean.
29. **Planting consumes a seed before the server acks.** `performFarmAction`
    decrements the local seed count, then emits `farmAction`; a rejected plant
    loses that seed. This is the one intentional optimistic mutation — don't
    copy the pattern for tiles or barn counts.

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
- Rare mutation seeds are not persisted server-side.
- Server-side passive watering for Frost-Crisp Lettuce is not implemented.
- Server growth calculation does not include lettuce moisture retention, while
  the client `LocalFarmStore` does.
- `FarmStore` uses direct Ecto reads/writes; `notes/sqlite-plan.md`’s
  write-behind cache design is outdated.
- `farms.tomatoes` remains for compatibility and is read by the dashboard and
  farm HUD.
- `FARM_HARVEST_YIELD` and `Farm.harvest_yield/0` are dead constants.
- `User.createdAt` in `shared/auth.ts` does not match the server payload.
- The economy trusts client-supplied deltas; it is a game, not a ledger.
- Casino games are entirely client-side; only the resulting wallet delta is
  synced.
- The farm’s rendered field is a small patch, but the server accepts a 15×15
  action area.

---

## 15. Further reading

- `README.md` — setup, database location, tests, deploy.
- `notes/farming-mechanics.md` — crop/mechanic reference and asset mapping.
- `notes/change-policy.md` — branch/PR/review policy.
- `notes/WireFrameLayout.md` — HUD/menu/inventory layout intent.
- `notes/GameDesignNotes.md` — high-level game direction.
- `notes/sqlite-plan.md` — historical persistence design (not current code).
- `deploy/` — systemd unit, env, deploy script.
- `.github/workflows/ci.yml` — exactly what CI runs.
