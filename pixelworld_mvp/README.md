# PixelWorld Work Village MVP

Standalone phase-one visualization for CLI_Pixelverse Agent activity. The fixed camera always shows the complete outdoor village, including every public road and front door. Use the floating test panel to select an Agent, inspect its `Outdoor`/`Inside …` presence, and dispatch the same normalized states used by real hooks.

## Requirements

- Node.js 20.19 or newer
- npm

## Run

```bash
npm install
npm run dev -- --host 127.0.0.1
```

Open `http://127.0.0.1:5173`.

## Verify

```bash
npm test
npm run typecheck
npm run build
```

## MVP behavior

- Three functional buildings: Knowledge & Planning Hall, Build Workshop, Collaboration & Signal Station.
- Four open zones: Arrival/Queue Plaza, Thinking Garden, Lounge Lawn, Repair Corner.
- Test triggers for initialization, thinking, planning, reading, editing, tools, external services, clone, response, waiting, blocked, self-healing, idle, offline, and heartbeat. These buttons call `WorldScene.dispatchDemo`; production hooks enter through the same validated `AgentWorldEvent` path.
- Every building has an explicit outside tile and threshold. An Agent exits its old front door, prefers the visible public road, crosses the destination threshold, then hides. Building occupancy is published only after physical arrival.
- Outdoor hooks keep the Agent visible. Inside Agents are represented by the building activity badge instead of a chip floating through the roof.
- Clone Agents emerge visibly from the Collaboration & Signal Station door. The village enforces the main-plus-ten Agent limit.
- Fixed global camera, weighted four-direction A*, work-slot queues, foot-Y depth, roof/tree/door-frame occlusion, Agent chips, speech bubbles, and building activity summaries.
- Debug overlays expose the tile grid, blocked tiles, current Agent paths, station anchors, and foot-depth lines. Enable them from the test panel when validating a hook mapping.

## Art and rendering

- Outdoor tiles use the CC0 **Puny World 16×16** sheet.
- Agents use CC0 **Ninja Adventure** character sheets.
- Rendering stays on native 16×16 cells with nearest-neighbor integer scaling; no Nintendo/Game Freak or extracted Pokémon assets are included.
- Canonical URLs, authors, licenses, selected files, and retrieval date are recorded in [`public/assets/ASSET_SOURCES.md`](public/assets/ASSET_SOURCES.md).

## Phase boundary

Phase one is deliberately outdoor-only. Entering a building changes presence and hides the Agent; it does not open an interior scene. A later phase can attach an interior/status view to the existing building IDs and thresholds without changing hook routing.

This package has no backend. Future hook adapters must emit `AgentWorldEvent`; they must not call Phaser systems directly.
