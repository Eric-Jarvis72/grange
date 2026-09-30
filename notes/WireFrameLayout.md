### In-Game HUD Framework
**Description:**
Establish the skeletal UI for the main gameplay view. The design must be minimalist to prioritize visibility of the physical farm world.

**Acceptance Criteria:**
-  **Top Screen:** Completely clear of UI elements.
-  **Bottom Center:** Implement a horizontal Toolbar/Hotbar with 8-10 slots. These must map to the numeric keys (1-0) for tools, seeds, and active items.
-  **Bottom Left:** Implement a chat/notification feed for whitelist collaboration. Must include a fade-out animation when inactive.
-  **Bottom Right:** Add minimalist keyboard prompts (e.g., `[I] Inventory`, `[Esc] Pause`).

### Main Menu Framework
**Description:**
Build the title screen layout. The UI should be heavily weighted to the left side to allow the background art (run-down farm and train) to remain visible.

**Acceptance Criteria:**
-  **Top Left:** Display the Grange game logo.
-  **Middle Left:** Create a vertical navigation list with the following buttons:
  - Continue / Load Farm
  - New Farm
  - Join Farm (Multiplayer/Whitelist)
  - Settings
  - Quit to Desktop
-  **Bottom Right:** Display the game version number and class team watermark.

### Pause Menu Overlay
**Description:**
Create the pause menu overlay triggered by the `[Esc]` key.

**Acceptance Criteria:**
-  **Background:** Implement a darkening or blurring effect over the live game world when active.
-  **Center Screen:** Create a vertical panel containing:
  - **Header:** "Paused"
  - **Button 1:** Resume Game
  - **Button 2:** Settings (Opens sub-tabs for Audio, Video, Controls)
  - **Button 3:** Whitelist Management
  - **Button 4:** Quit to Main Menu
  - **Button 5:** Quit to Desktop

### Inventory Screen Layout
**Description:**
Design the physical inventory UI where players manage seeds, tools, and Grangecoin.

**Acceptance Criteria:**
-  **Left Column:** Render a 3D visual preview of the player model showing currently equipped gear/clothing.
-  **Center/Right Area:** Implement a standard grid of square inventory slots.
-  **Currency Logic:** Configure Grangecoin to function as a physical, stackable item occupying standard inventory slots rather than utilizing a fixed, persistent UI counter.