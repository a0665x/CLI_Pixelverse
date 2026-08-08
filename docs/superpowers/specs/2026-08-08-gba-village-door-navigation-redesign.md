# GBA Village Door Navigation Redesign

Date: 2026-08-08
Status: approved by user
Scope: PixelWorld Work Village, first-stage outdoor world

## Goal

Replace the placeholder-looking village with a cohesive 16×16 top-down world inspired by the readable layout language of GBA-era monster-adventure villages, without copying or extracting Nintendo/Game Freak assets. Buildings must have unmistakable front doors, and Agents must move through the world as if roads and entrances are real places rather than taking geometric shortcuts.

## Approved first-stage behavior

- The camera remains a fixed whole-village view.
- There is no explorable interior scene in this stage.
- An Agent entering a building walks to its exterior approach, crosses the visible front-door threshold, then becomes hidden.
- The building status overlay remains visible and lists the Agent and current hook-derived activity.
- When the Agent later travels elsewhere, it first reappears at the current building's threshold, exits through the same front door, and then follows the public path network.
- Outdoor destinations keep the Agent visible.
- Multiple Agents may be inside different buildings at the same time; the fixed view and building overlays remain the primary observation surface.

## Asset decision

### Selected

1. **Puny World 16×16** by Shade for grass, paths, water, trees and building exteriors.
   - Source: https://opengameart.org/content/16x16-puny-world-tileset
   - License: CC0.
2. **Ninja Adventure** by Pixel-Boy and AAA for directional characters and selected work props/UI elements.
   - Source: https://pixel-boy.itch.io/ninja-adventure-asset-pack
   - License: CC0.

Both source URLs and license snapshots will be recorded in the repository. Attribution is not legally required for these CC0 packs, but the project will credit both creators.

### Reference only

- Aarya's Pokémon-like work may guide color relationships, route readability and village spacing, but no Aarya asset will be shipped in this stage because the free pack's permission is described informally in creator comments rather than a bundled standard license.

### Excluded

- Pokémon Essentials tilesets, extracted Gen 3 tiles, Ruby/Sapphire rips, and fan-game-only assets.
- Pixelart Village Free Pack because its terms prohibit AI-related projects.
- Sprout Lands Basic because its free version is non-commercial.

## Approaches considered

### A. Puny World exterior plus Ninja Adventure actors and props — selected

This best matches the requested village silhouette while retaining a complete directional character and work-object library. Only a small curated Ninja subset will be used, and colors will be normalized at render time or by selecting compatible variants so the result does not look like unrelated packs were pasted together.

### B. Ninja Adventure only

This has the lowest integration risk and strongest internal consistency, but its ninja/fantasy identity is less like the requested bright GBA village.

### C. Kenney Tiny Town only

This is license-safe and fast, but its intentionally tiny, abstract style would preserve too much of the current prototype feeling.

## World layout

The new village uses a clear north-building / central-plaza / south-garden composition:

- Three purpose-specific buildings face south toward the public road.
- Every building has a visible two-tile-wide facade opening, door frame, threshold and short front path.
- A main east-west road connects the three front paths.
- A central north-south road connects the spawn plaza, lounge lawn and outdoor work zones.
- Trees, fences, water and flowerbeds shape routes instead of acting as decoration placed over open grass.
- Outdoor stations connect to the nearest road through short intentional paths.
- No station anchor is placed through a wall, behind a building, or on decorative terrain.

The visual road map and navigation surface derive from the same world data so they cannot drift apart.

## Navigation model

### Terrain costs

The existing A* implementation will support traversal costs:

- public path / plaza: cost 1
- door approach and threshold: cost 1
- outdoor station apron: cost 1–2
- ordinary grass: cost 5
- flowerbed, water, tree trunk, fence, building shell: blocked

Grass remains available for legitimate open-environment hooks, but cross-village routes naturally prefer roads. Building routes additionally use mandatory doorway waypoints, so cost ties can never produce wall-adjacent shortcuts.

### Door topology

Each building definition gains one explicit entrance:

- `outside`: walkable tile immediately in front of the door
- `threshold`: visible door tile crossed during entry/exit
- `facing`: normally `up` on entry and `down` on exit

Building stations are logical interior destinations. They no longer expose outdoor work slots. A building-bound dispatch resolves to a multi-leg trip ending at the entrance threshold; after arrival, the Agent becomes an inside occupant.

### Agent presence state

Each Agent is in one of two presence states:

- `outside` with a tile position and visible sprite
- `inside` with a `buildingId` and hidden sprite

Dispatching an inside Agent to a new destination begins with an exit transition: position the hidden Agent at the old threshold, reveal it, step outward, then calculate the remaining path. Retargeting and cancellation preserve a valid presence state and never teleport an Agent across a building.

## Hook-to-place mapping

- `session_start`, `respond`: central arrival/collaboration plaza
- `think`, `plan`, `read`: Knowledge Hall through its front door, with garden overflow for outdoor thinking
- `edit`, general `working`: Build Workshop through its front door
- `tool`, `web`, `self_heal`: Signal Station through its front door
- `clone`: Signal Station dispatch desk; new Subagent exits through that building's door
- `await`, `blocked`: marked outdoor queue/repair apron connected to the road
- `idle`: lounge lawn/bench area
- `offline`: quiet edge of the arrival plaza
- `heartbeat`: preserves current location and only pulses the status presentation

## Rendering

- Phaser remains the engine; Godot is not required for this stage.
- Puny World is loaded as a 16×16 spritesheet and rendered with nearest-neighbor scaling.
- Buildings are tile compositions, not colored rectangles.
- Roofs and tree canopies are registered as foreground occluders using their actual bounds and foot baselines.
- Door frames remain above an entering Agent while the threshold stays below it, creating a readable step-through effect.
- World-space building labels are reduced and integrated as small signboards; the art, door and path should communicate location before text is read.
- Status overlays keep their current screen-readable pixel UI but use a constrained palette sampled from the selected world tiles.

## Asset handling

- Download only from the original OpenGameArt/itch.io/GitHub sources.
- Keep the full source asset outside the production bundle when possible; copy only the frames used by the MVP or load a curated spritesheet.
- Add `ASSET_SOURCES.md` with author, canonical URL, license, retrieval date, selected files and any transformations.
- Preserve source license text alongside the assets.
- Do not combine or ship any image whose origin or license cannot be proven.

## Error handling

- World validation rejects a building without a walkable entrance or a door disconnected from the public path network.
- A building-bound hook that cannot reach its doorway reports `no-path` and keeps the Agent at its last valid position.
- An exit failure leaves the Agent logically inside and visible in the building overlay.
- Missing external images use an obvious diagnostic fallback and emit a console error; tests verify the manifest paths.

## Testing and acceptance

Automated coverage will verify:

- all buildings expose a valid entrance and threshold;
- every entrance connects to the main road;
- routes between each pair of buildings pass through the source and destination door tiles;
- cross-building paths prefer roads instead of straight grass shortcuts;
- entering hides the Agent and updates building occupancy;
- leaving reveals the Agent at the correct old doorway before travel;
- outdoor hooks remain visible and reachable;
- clone capacity, retargeting, cancellation and status priorities continue to work;
- the asset manifest contains only recorded sources.

Browser acceptance will exercise every test-panel action, inspect path-debug overlays, verify entry/exit visually at all three buildings, verify multiple simultaneous occupants, test 1280×720 and 840×480 layouts, and finish with a clean application console.

## Out of scope

- Interior scenes or room cameras.
- Real CLI/hook transport integration.
- User-controlled movement.
- Combat, inventory, NPC dialogue trees or day/night systems.
- Any copyrighted Pokémon asset or close sprite reproduction.
