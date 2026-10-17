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
  `CROPS[*].seedCost`): wheat `2c`, lettuce `4c`, tomato `8c`.
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

The old placeholders (`farm/plants/tomato-plant.webp`, `farm/plants/wheat.webp`,
`farm/plants/leafy-greens.webp`, `farm/objects/scythe.svg`) were removed and
`farm/manifest.json` was updated with `crops` and `tools` sections.

## 6. Where the logic lives

| Concern | File(s) |
| :--- | :--- |
| Crop registry, stage sprites, economy | `shared/crops.ts` |
| Combo tiers, synergy bonuses, mutation formula | `shared/mechanics.ts` |
| Tile model, neighbours, crop encode/decode | `shared/farm.ts` |
| Client farm simulation (tests/local play) | `src/world/farmState.ts` |
| Crop + sweep rendering, resource loading | `src/world/cropLayer.ts`, `resources.ts`, `sweepFx.ts` |
| Combo tracker + HUD counter | `src/world/comboTracker.ts`, `farmCombo.ts`, `ComboCounter.tsx` |
| Action resolution + barn reconciler | `src/world/farmActions.ts`, `barnSync.ts` |
| Market data + controls | `src/world/marketData.ts`, `useFarmMarket.ts` |
| Server crop registry | `backend/lib/grange/crops.ex` |
| Server action parsing + drop roll | `backend/lib/grange/farm_action.ex` |
| Server barn + harvest/regrow/sell | `backend/lib/grange/farm_store.ex`, `barn_item.ex` |
