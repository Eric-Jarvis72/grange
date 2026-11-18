# Grange UI Art Style & Design Guide

This document is the single source of truth for **Grange**'s user interface aesthetic, color palette, layout architecture, and CSS specifications. Use this guide (or reference it in prompts for OpenCode / DeepSeek / Cursor) whenever creating new menus such as the **Train Station**, **Casino**, **Pause Menu**, or **Land Expansion** overlays.

---

## 1. Core Visual Direction

* **Genre Aesthetic:** Cozy 16-bit/32-bit 2D pixel-art rustic farm UI (inspired by classic tabletop carpentry, brass/iron hardware, and warm parchment).
* **Crisp Pixel Rendering:** All UI containers, borders, and `.webp` sprites must enforce `image-rendering: pixelated;` with zero anti-aliasing or soft drop-shadows.
* **Tactile Layered Framing:** Menus are constructed to look like physical wooden signboards with recessed parchment wells, corner hardware studs, and beveled 3D pixel buttons.
* **No Stretched Bitmap Backgrounds:** Frame borders and recessed wells should be built using crisp multi-layered CSS `border` and `box-shadow` steps so panels scale cleanly to any grid size without blurring pixels.

---

## 2. Minimalist HUD Architecture

Per our class design specifications, the in-game viewport prioritizes visibility of the physical farm, train, and player model:

1. **Top of Screen (Normal Gameplay):**
   * Completely clear of permanent UI counters.
   * **Grangecoin (`GC`)** is hidden during normal roaming and only appears as a top-right wooden balance badge (`BALANCE: 1,240 GC`) or physical stackable inventory item when an overlay (Market, Inventory, Train, Casino) is open.
2. **Bottom Center (Always Visible):**
   * **10-Slot Numeric Hotbar (`1–10` / `1–0`):** Horizontal wooden toolbar anchored at the bottom center of the screen for active tools (`scythe_basic`, `scythe_iron`, `scythe_runed`, watering can), seeds, and items.
   * Remains visible and interactive while the Market or Inventory modal is open so items can be organized directly into active slots.
3. **Bottom Left:**
   * Minimalist chat and notification feed for multiplayer whitelist collaboration; automatically fades out when inactive.
   * When a modal is open, displays the close shortcut prompt (`[ESC] Close`).
4. **Bottom Right:**
   * Unobtrusive context-sensitive keyboard prompts during gameplay (e.g., `[I] Inventory`, `[E] Mount`, `[Esc] Pause`) and modal navigation prompts when a menu is open (e.g., `[TAB] Switch`).

---

## 3. Master Color Palette

### Wood & Structural Frames
| Role | Hex | Usage |
| :--- | :--- | :--- |
| **Outer Frame Border** | `#2b1709` | Darkest espresso pixel outline (`4px solid`) on all main wooden panels |
| **Primary Wood Fill** | `#6e472b` | Main warm oak background for modal headers and outer frames |
| **Wood Highlight Bevel** | `#9c683e` | Inner top/left highlight (`inset 0 0 0 4px`) for 3Dplank depth |
| **Wood Shadow Bevel** | `#4d2f18` | Inner bottom/right shadow bevel and inventory slot borders |
| **Inventory Slot Fill** | `#9c7853` | Recessed square slot background inside the player inventory grid |

### Parchment & Item Cards (Shop / Produce Wells)
| Role | Hex | Usage |
| :--- | :--- | :--- |
| **Parchment Well Fill** | `#d8c39e` | Recessed interior container background holding item cards |
| **Parchment Inner Shadow** | `#bda57e` | Top inset shadow (`inset 0 4px 0`) inside parchment wells |
| **Item Card Fill** | `#e8d7b9` | Individual seed, tool, or produce card background |
| **Item Card Inner Highlight**| `#f5ead6` | `2px` inner highlight border on item cards |
| **Primary Dark Ink Text** | `#2b1709` | Item titles, prices (`GC`), and `STOCK:` counters on parchment |
| **Header Cream Text** | `#fff6e5` | Modal titles and balance text rendered on dark wood headers |

### Interactive Buttons & Accents
| Role | Hex | Usage |
| :--- | :--- | :--- |
| **Primary Action Green** | `#6b8e3d` | `BUY`, `SELL 1`, `SELL ALL`, and confirm buttons |
| **Green Top Highlight** | `#8fb55b` | Top inner bevel on green buttons |
| **Green Border / Shadow** | `#233311` | Outer pixel border and bottom drop-step on green buttons |
| **Danger / Close Red** | `#8c2d24` | `CLOSE [X]` button background (highlight `#b8463b`, border `#380e0a`) |
| **Disabled Button Grey** | `#7a736b` | Out-of-stock (`STOCK: 0`) or unaffordable (`balance < cost`) buttons |
| **Grangecoin Gold** | `#f5b82e` | Coin icon fill and currency text accent |

### Rare Mutant Tier Card Borders
Rare mutant crops in the Produce Stall (and rare items in future menus) use distinct elemental borders to stand out from standard items:
* **Midas Wheat (`midas_wheat`):** Outer border `#d49b1b`, inner glow `#fff3a1`, shadow `#6e4b08` (Golden aura).
* **Frost-Crisp Lettuce (`frost_lettuce`):** Outer border `#3b98c4`, inner glow `#d4f4ff`, shadow `#1b4d6b` (Icy blue aura).
* **Sun-Burst Tomato (`sunburst_tomato`):** Outer border `#d95326`, inner glow `#ffd8b8`, shadow `#6e220b` (Radiant solar orange aura).

---

## 4. Typography & Iconography Rules

* **Font Stack:** `'Press Start 2P', 'VT323', monospace, sans-serif`
* **Text Styling:**
  * Modal and stall titles (`GRANGE MARKET - SEED STALL`, `INVENTORY`, `HOTBAR`) are always **UPPERCASE** with a crisp dark pixel drop-shadow (`2px 2px 0 #2b1709`).
  * Stack quantities in inventory slots sit at `bottom: 2px; right: 4px` in white (`#ffffff`) with a `1px 1px 0 #000000` outline so they remain legible over any sprite.
* **Sprite Sizing:**
  * Inventory slot icons: `40x40px` centered inside `56x56px` square slots.
  * Shop / Produce card icons: `48x48px` to `52x52px` rendered from `/assets/crops/*.webp`, `/assets/tools/*.webp`, and `/assets/horses/*.webp`.

---

## 5. Standard Layout Patterns

### Pattern A: Split Two-Panel View (Used for `Seed Stall` & `Inventory`)
* **Left Panel:** Context action panel (e.g., `SHOP - BUY` with a 3-column grid of parchment item cards, or `CHARACTER PREVIEW` when opening standalone inventory).
* **Right Panel:** Player `INVENTORY` panel featuring the 2D pixel character portrait box on the top-left alongside a 5-column grid of `56x56px` square slots.
* **Bottom Bar:** 10-slot `HOTBAR` centered underneath both panels.

### Pattern B: Centered Catalog Grid (Used for `Produce Stall`, `Train Upgrades`, etc.)
* Single wide wooden frame (`860px` max-width) with a title header and integrated top-right `BALANCE: <amount> GC` badge.
* Inner parchment well displaying a `3x2` grid of cards.
* Each card includes:
  * **Header:** Uppercase Item Name
  * **Body:** Left sprite preview + Right unit price (`GC`) and live server stock (`STOCK: <count>`)
  * **Footer:** Side-by-side quick action buttons (`SELL 1` and `SELL ALL`).

---

## 6. Reusable CSS Reference (`grange-ui.css`)

Drop these base classes into any new UI component to match the existing Market and Inventory menus:

```css
.grange-modal-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(14, 10, 8, 0.55);
  backdrop-filter: blur(3px);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  z-index: 50;
  font-family: 'Press Start 2P', monospace, sans-serif;
  image-rendering: pixelated;
  user-select: none;
}

.grange-wood-panel {
  background: #6e472b;
  border: 4px solid #2b1709;
  box-shadow:
    inset 0 0 0 4px #9c683e,
    inset 0 0 0 8px #4d2f18,
    0 10px 0 rgba(0, 0, 0, 0.45);
  padding: 16px;
  color: #fff6e5;
}

.grange-parchment-well {
  background: #d8c39e;
  border: 4px solid #3c2412;
  box-shadow: inset 0 4px 0 #bda57e;
  padding: 14px;
  color: #2b1709;
}

.grange-item-card {
  background: #e8d7b9;
  border: 3px solid #4d2f18;
  box-shadow: inset 0 0 0 2px #f5ead6, 0 4px 0 #3c2412;
  padding: 10px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
}

.grange-item-card.mutant-midas {
  border-color: #d49b1b;
  box-shadow: inset 0 0 0 2px #fff3a1, 0 4px 0 #6e4b08;
}

.grange-item-card.mutant-frost {
  border-color: #3b98c4;
  box-shadow: inset 0 0 0 2px #d4f4ff, 0 4px 0 #1b4d6b;
}

.grange-item-card.mutant-sunburst {
  border-color: #d95326;
  box-shadow: inset 0 0 0 2px #ffd8b8, 0 4px 0 #6e220b;
}

.grange-btn {
  background: #6b8e3d;
  color: #ffffff;
  border: 3px solid #233311;
  box-shadow: inset 0 3px 0 #8fb55b, 0 3px 0 #1a260c;
  padding: 6px 12px;
  font-weight: bold;
  cursor: pointer;
  text-transform: uppercase;
}

.grange-btn:active:not(:disabled) {
  transform: translateY(2px);
  box-shadow: inset 0 2px 0 #8fb55b, 0 1px 0 #1a260c;
}

.grange-btn:disabled {
  background: #7a736b;
  border-color: #3d3935;
  box-shadow: none;
  opacity: 0.6;
  cursor: not-allowed;
}
```