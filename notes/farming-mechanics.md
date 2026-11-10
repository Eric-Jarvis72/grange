# Farming Mechanics & Crop Reference

This is the living reference for the starter farming layer. The single source of
truth for the numbers is `shared/crops.ts` (`CROPS`) and `shared/mechanics.ts`;
the Phoenix backend mirrors the same registry in `backend/lib/grange/crops.ex`.
If you change a value, change it in both places and update this table.

## 1. Crops & Rare Variants

| Crop Name | ID | Tier | Stages | Seed Cost | Sell Value | Harvest Tool | Regrowth | Unique Grid Mechanic (Orthogonal `N, S, E, W`) | Synergy Condition (for Mutation Bonus) |
| :--- | :--- | :--- | :---: | :---: | :---: | :---: | :---: | :--- | :--- |
| **Wheat** | `wheat` | Standard | 5 (`0`–`4`) | 2c | 4c | **Scythe Only** | Single harvest | **Pack Mentality:** `+5%` growth speed per adjacent Wheat/Midas Wheat (max `+20%`). | Adjacent to `>= 2` Wheat tiles |
| **Lettuce** | `lettuce` | Standard | 5 (`0`–`4`) | 4c | 7c | Hand or Scythe | Single harvest | **Moisture Sponge:** while watered, its 4 orthogonal neighbors decay moisture `25%` slower. | Hydrating `>= 1` adjacent crop |
| **Tomato** | `tomato` | Standard | 5 (`0`–`4`) | 8c | 5c *(x2 = 10c)* | Hand or Scythe | `2` harvests *(regrows from Stage `2`)* | **Space-Hungry:** `-20%` growth speed if touching any Tomato; `+15%` growth speed if touching any Lettuce. | Adjacent to `>= 1` Lettuce and `0` Tomatoes |
| **Midas Wheat** | `midas_wheat` | Rare Mutant | 4 (`0`–`3`) | *Drop Only* | 10c | **Scythe Only** | Single harvest | **Combo Booster:** grants `+3` to `comboCount` and refreshes the timer on harvest. Counts toward Wheat adjacency. | *N/A (Mutant)* |
| **Frost-Crisp Lettuce** | `frost_lettuce` | Rare Mutant | 4 (`0`–`3`) | *Drop Only* | 15c | Hand or Scythe | Single harvest | **Living Sprinkler:** while left unharvested at Stage `3`, waters all 4 orthogonal neighbors at the start of each cycle. | *N/A (Mutant)* |
| **Sun-Burst Tomato** | `sunburst_tomato` | Rare Mutant | 3 (`0`–`2`) | *Drop Only* | 8c *(x3 = 24c)* | Hand or Scythe | `3` harvests *(regrows from Stage `1`)* | **Self-Seeding:** `10%` chance on each harvest to drop `1` bonus standard `tomato_seed`. | *N/A (Mutant)* |

Harvest tool notes:

- The scythe is the universal harvest swing: using it on any planted tile
  dispatches a harvest, and the server enforces readiness.
- A **Scythe Only** crop clicked with any other tool shows a shake prompt
  (`"<Crop> needs a scythe."`) and does not harvest.
- **Hand or Scythe** crops are picked by hand when clicked with any non-scythe
  tool, and can also be cut with the scythe.
- Every harvest yields **1** produce item. Regrowing crops keep the tile and
  resume growing from their reset stage instead of clearing it.

## 2. Action Combo System

Valid farming actions (**Till**, **Plant**, **Water**, **Harvest**) increment
`comboCount` by `+1` and reset the decay timer. Clicking invalid or
already-watered tiles does not increment the combo. The tracker is **client
side** (`src/world/comboTracker.ts`); only the mutation multiplier is sent with
a harvest.

| Combo Streak | Timer Window | Active Gameplay Perk |
| :---: | :---: | :--- |
| **1x – 4x** | `1.5s` decay *(`+0.4s` once per hotbar swap on a different action)* | Tracks streak; combo badge appears at `3x+`. |
| **5x – 9x** | `1.5s` decay | **+10% player walk speed** while on farm tiles. |
| **10x – 14x** | `1.5s` decay | **15% splash/cleave chance** when watering or scything to affect 1 valid orthogonal neighbor. |
| **15x+** | `1.5s` decay | **1.5x multiplier** applied to Rare Mutation Seed drop rolls on harvest. |

## 3. Rare Mutation Seed Drop Rates

Rolled whenever a **Standard Crop** (`wheat`, `lettuce`, `tomato`) is harvested
at its Mature stage:

| Roll Condition | Formula / Modifier | Effective Drop Chance | Approx. Odds |
| :--- | :---: | :---: | :---: |
| **Base Harvest** *(No active synergy, Combo < 15x)* | `Base` | **0.15%** | ~1 in 667 |
| **Base Harvest + 15x Combo** *(No active synergy)* | `0.15% * 1.5` | **0.225%** | ~1 in 444 |
| **Active Grid Synergy** *(Combo < 15x)* | `0.15% + 0.25%` | **0.40%** | 1 in 250 |
| **Optimal Harvest** *(Active Synergy + 15x Combo)* | `(0.15% + 0.25%) * 1.5` | **0.60%** | ~1 in 167 |

Dropped seeds (`midas_wheat_seed`, `frost_lettuce_seed`,
`sunburst_tomato_seed`) currently land in the **local, session-scoped**
inventory and are not yet persisted server-side. The same roll is mirrored on
the server (`Grange.FarmAction.mutation_drops/5`) so the logic stays in sync.

## 4. Barn, Economy & Market

Produce is stored per crop in the `barn_items` table (`owner`, `item`, `count`),
where `item` is the crop id. Each unique crop has its own barn row; the legacy
`farms.tomatoes` column is deprecated and no longer written. The migration
`20261016000000_add_barn_items.exs` creates the table and backfills existing
`tomatoes` as `('tomato', n)`; it runs automatically on boot in dev, test, and
the production release.

- Harvesting increments the barn row for the harvested crop by 1.
- The market's **Seed** stall sells one seed per standard crop (priced from
  `CROPS[*].seedCost`): wheat `2c`, lettuce `4c`, tomato `8c`. Each seed card
  uses the same quantity stepper as the produce sell control, capped at what the
  player can afford and can hold, so seeds can be bought in bulk in a single
  transaction.
- The market's **Produce** stall sells each of the six produce items at
  `CROPS[*].sellValue`: wheat `4c`, lettuce `7c`, tomato `5c`, Midas Wheat
  `10c`, Frost-Crisp Lettuce `15c`, Sun-Burst Tomato `8c`.
- Selling decrements the barn row; the client reconciles its inventory to the
  barn on every farm snapshot, so a sold item disappears from the inventory too.
- The client economy balance is mirrored to `users.balance` via
  `/api/economy/transaction`.

## 5. Asset File Mapping (`public/assets/`)

| Category | Asset Path Pattern | Files Included |
| :--- | :--- | :--- |
| **Tomato Sprites** | `/assets/crops/tomato_*.webp` | `0_seed`, `1_sprout`, `2_medium`, `3_flowering`, `4_mature`, `harvested` |
| **Sun-Burst Tomato** | `/assets/crops/sunburst_tomato_*.webp` | `0_sprout`, `1_flowering`, `2_mature`, `harvested` |
| **Wheat Sprites** | `/assets/crops/wheat_*.webp` | `0_seed`, `1_sprout`, `2_young`, `3_golden`, `4_mature`, `harvested` |
| **Midas Wheat** | `/assets/crops/midas_wheat_*.webp` | `0_seed`, `1_sprout`, `2_radiant`, `3_mature`, `harvested` |
| **Lettuce Sprites** | `/assets/crops/lettuce_*.webp` | `0_seed`, `1_sprout`, `2_leaf`, `3_loose`, `4_mature`, `harvested` |
| **Frost-Crisp Lettuce** | `/assets/crops/frost_lettuce_*.webp` | `0_seed`, `1_sprout`, `2_young`, `3_mature`, `harvested` |
| **Scythes & FX** | `/assets/tools/*.webp` | `scythe_basic`, `scythe_iron`, `scythe_runed`, `sweep_fx_0`, `sweep_fx_1`, `sweep_fx_2` |
| **Fences & Gates** | `/assets/farm/fences/*.webp` | `post`, `rail-horizontal`, `rail-vertical`, and four `gate-{closed,open}-{horizontal,vertical}` variants |

Fences and gates share one post graph. Owners place both from the hotbar (Gate key `5`,
Fence key `6`, Shovel key `7`), and each has an independent server supply (20 fences, 2
gates by default). Rails are derived from neighboring posts; placing or removing any post
re-aims adjacent gates, preferring a horizontal neighbor, then a vertical one, then
horizontal. A closed gate has the same collision as a fence rail and post. Walking within
90px and pressing E or Enter toggles the gate for anyone visiting the farm; open gates remove
only the rail they cover, so players can walk through the gap. Gate open state and direction
persist in `farm_gates`; `farms.gate_count` tracks the remaining supply.

The old placeholders (`farm/plants/tomato-plant.webp`, `farm/plants/wheat.webp`,
`farm/plants/leafy-greens.webp`, `farm/objects/scythe.svg`) were removed and
`farm/manifest.json` was updated with `crops` and `tools` sections.

## 6. Where the logic lives

| Concern | File(s) |
| :--- | :--- |
| Crop registry, stage sprites, economy | `shared/crops.ts` |
| Combo tiers, synergy bonuses, mutation formula | `shared/mechanics.ts` |
| Tile model, neighbours, crop encode/decode | `shared/farm.ts` |
| Server farm simulation | `backend/lib/grange/farm.ex`, `farm_store.ex`, `farm_tick.ex` |
| Crop + sweep rendering, resource loading | `src/world/cropLayer.ts`, `resources.ts`, `sweepFx.ts` |
| Combo tracker + HUD counter | `src/world/comboTracker.ts`, `farmCombo.ts`, `ComboCounter.tsx` |
| Action resolution + barn reconciler | `src/world/farmActions.ts`, `barnSync.ts` |
| Market data + controls | `src/world/marketData.ts`, `useFarmMarket.ts` |
| Server crop registry | `backend/lib/grange/crops.ex` |
| Server action parsing + drop roll | `backend/lib/grange/farm_action.ex` |
| Fence/gate graph, collision, rendering | `src/world/fenceData.ts`, `fenceRendering.ts`, `sceneObstacles.ts` |
| Gate placement, E interaction, prompts | `src/world/fenceActions.ts`, `gateInteraction.ts`, `FarmMapScene.ts` |
| Server barn + harvest/regrow/sell | `backend/lib/grange/farm_store.ex`, `barn_item.ex` |
| Server tick sweep (ripen, revert untended soil) | `backend/lib/grange/farm_tick.ex` |
| Server fence/gate persistence | `backend/lib/grange/farm_fences.ex`, `farm_gates.ex`, `farm_gate.ex` |

## 7. Automation: Sprinklers & the Hardware Store

- Sprinklers are bought at the **Hardware Store**, a walkable scene entered from
  the marketplace (`POST /api/hardware/buy`, 75c each). Purchases add to
  `farms.sprinkler_count`, which the client mirrors into the hotbar
  (`useFarmObjectInventory.ts`).
- A sprinkler is anchored by the top-left tile of a 2x2 block and drawn on the
  shared corner of those four tiles (`src/world/sprinklerData.ts`). While it
  stands, every `planted` tile in its square is watered by `FarmStore.tick/1`
  (via `Grange.FieldWater`), using the same synergy-adjusted growth clock as a
  watering can, so crops keep ripening. A `ready` tile is never re-watered.
  Bare `tilled` soil in the square is also kept moist: it is exempt from the
  till-decay sweep (see §8), and placing or lifting the sprinkler restamps the
  covered tiles' drying clock.
- The client draws the sprinkler as a static green base plus a brass rotor that
  spins briefly about once a minute with a water spray
  (`src/world/sprinklerRendering.ts`); the tick, not the animation, waters. It is
  drawn under the crop layer, so mature plants render in front of it.
- The hardware stall also sells the basic tools (one-off) and restocks fences and
  gates through the same `POST /api/hardware/buy` endpoint.
- Shoveling a sprinkler returns it to the farm's supply and stops coverage, so
  later plantings there are no longer watered automatically.
- Files: `src/world/sprinkler*.ts`, `SprinklerPlacementPreview.ts`; the
  hardware stall is a marketplace stand (`marketplaceData.ts`,
  `MarketplaceScene.ts`, `marketData.ts`, `useFarmMarket.ts`) that opens the
  shared market window. Server: `backend/lib/grange/farm_sprinklers.ex`,
  `field_water.ex`, `hardware.ex`, `hardware_controller.ex`.

## 8. Tilled Soil Revert

Bare tilled ground dries out. A tile left in the `tilled` state for **20
minutes** (`Farm.till_decay_ms/0`) reverts to grass on the next tick.

- Only the empty `tilled` state counts down. Planting or watering moves the tile
  to `planted`/`watered` and clears its `tilled_at` stamp, so a crop is safe
  until it is harvested.
- Soil under a sprinkler never decays: `FarmTick.revert_untended/1` skips any
  tile covered by a sprinkler, and placing or lifting a sprinkler restamps the
  covered tiles' `tilled_at`, so removal starts a fresh 20-minute window.
- Harvesting a crop that clears the tile back to bare ground stamps a fresh
  `tilled_at`, restarting the window.
- The revert is silent: no client warning, countdown, or new wire field. The
  server deletes the tile and pushes the full farm, and the client repaints
  grass because `FarmTileSync.sync/1` removes tiles that are no longer present.
- Server only: `FarmTick.run/1` owns the sweep. There is no client-side farm
  simulation to keep in sync; the client repaints whatever `farmUpdate` sends.

## 9. Growth Clock and the E2E Override

A watered tile ripens after `Farm.grow_ms/0` — **10 seconds** by default, then
scaled by the crop's grid synergy. `Farm.water/2` stamps `ready_at` with it, and
`FarmTick` flips the tile to `ready` once that deadline passes.

The value comes from `Application.get_env(:grange, :grow_ms, 10_000)`, so
`backend/config/dev.exs` can shorten it:

- `GRANGE_GROW_MS` is read once at boot; unset means the normal 10 seconds.
- `playwright.config.ts` sets it to `500` in the e2e `webServer` env, so a spec
  waits half a second instead of ten for a harvest.
- Production config never sets it, and neither does `MIX_ENV=test`, so ExUnit
  still drives the clock with explicit `FarmStore.tick/1` calls.

Nothing else changes: the client never simulates growth, so the shortened clock
is invisible outside the server's tile states.
