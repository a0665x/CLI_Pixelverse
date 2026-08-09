# Village Art Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove exterior atlas artifacts, give animals believable facing-aware patrols, add purposeful RPG scenery, and upgrade all interiors with spaced LimeZu furniture and seating.

**Architecture:** Keep `WorldDefinition` as the source of navigation and scenery truth. Split deterministic exterior composition, animal motion/facing, and interior furniture assembly into testable pure contracts; Phaser systems only render those plans.

**Tech Stack:** TypeScript, Phaser 3, Vitest, Vite, LimeZu Serene Village Revamped, LimeZu Modern Interiors Free, Puny World CC0.

## Global Constraints

- Preserve the 48×28 fixed-camera world and eight hook buildings.
- Preserve all existing hook destination IDs and A* door routes.
- No ripped Pokémon/Nintendo/Game Freak assets.
- Serene Village remains CC BY 4.0; Modern Interiors Free remains prototype/non-commercial only.
- All source art uses nearest-neighbor rendering with no resampling.

---

### Task 1: Clean exterior atlas contract

**Files:**
- Modify: `pixelworld_mvp/src/rendering/VillageRenderer.ts`
- Test: `pixelworld_mvp/tests/villageRenderer.test.ts`

**Interfaces:**
- Produces: render commands where grass uses `WORLD_ATLAS`, Serene tree frames are a verified 2×2 set, and door thresholds have exactly one dirt command.

- [ ] Add failing assertions that all grass commands use `grassPlain` without a Serene texture override, every tree uses four verified frames, and no threshold has a duplicate Serene decoration.
- [ ] Run `npm test -- --run tests/villageRenderer.test.ts` and confirm the new assertions fail.
- [ ] Replace randomized Serene ground frames with the clean Puny grass cell, pin complete tree frames, and remove the extra threshold command.
- [ ] Re-run the focused test and confirm it passes.

### Task 2: Facing-correct ambient animals

**Files:**
- Modify: `pixelworld_mvp/src/rendering/AmbientAnimalSystem.ts`
- Test: `pixelworld_mvp/tests/ambientAnimalSystem.test.ts`

**Interfaces:**
- Produces: `AnimalMotionState.direction: 'left' | 'right' | 'idle'` and horizontal deterministic patrol targets.

- [ ] Add failing tests proving y never changes, right movement is unflipped, left movement is flipped, and pauses preserve the last facing.
- [ ] Run the focused test and confirm the direction assertions fail.
- [ ] Implement horizontal grazing targets and explicit direction state; render `flipX` from direction instead of comparing only the previous x coordinate.
- [ ] Re-run the focused test and confirm it passes.

### Task 3: Purposeful RPG village scenery

**Files:**
- Modify: `pixelworld_mvp/src/world/types.ts`
- Modify: `pixelworld_mvp/src/world/worldDefinition.ts`
- Modify: `pixelworld_mvp/src/rendering/VillageRenderer.ts`
- Test: `pixelworld_mvp/tests/sceneryDefinition.test.ts`
- Test: `pixelworld_mvp/tests/villageRoutes.test.ts`

**Interfaces:**
- Produces: data-driven landmark/decor points for well, orchard, pasture fence, riverbank, flower pockets, crates, rocks, and farm tools.

- [ ] Add failing tests for one central landmark, three distinct decoration zones, irregular tree clusters, and zero overlap with roads, entrances, stations, or animal lanes.
- [ ] Run focused scenery/route tests and confirm the new content assertions fail.
- [ ] Add scenery data and render commands while preserving all navigation corridors.
- [ ] Re-run focused tests and `validateWorld(WORLD_DEFINITION)`.

### Task 4: Detailed same-family interior furniture

**Files:**
- Modify: `pixelworld_mvp/src/rendering/assetManifest.ts`
- Modify: `pixelworld_mvp/src/world/types.ts`
- Modify: `pixelworld_mvp/src/world/interiorDefinitions.ts`
- Modify: `pixelworld_mvp/src/rendering/InteriorCutawaySystem.ts`
- Test: `pixelworld_mvp/tests/interiorCutawaySystem.test.ts`
- Test: `pixelworld_mvp/tests/interiorMotion.test.ts`

**Interfaces:**
- Produces: LimeZu atlas furniture groups with explicit cell footprints and seating in every interior theme.

- [ ] Add failing tests that each interior has seating, functional furniture footprints do not overlap, and workstation groups contain desk, monitor/device, and chair layers.
- [ ] Run focused interior tests and confirm the new assertions fail.
- [ ] Render multi-layer workstations from verified Modern Interiors atlas frames, add chairs/sofas/tables, and adjust layouts to keep one-cell walkways.
- [ ] Re-run focused tests and verify existing furniture routes remain unchanged.

### Task 5: Full visual and graph verification

**Files:**
- Modify: `pixelworld_mvp/public/assets/ASSET_SOURCES.md` only if additional source cells are used.

**Interfaces:**
- Consumes: all four completed tasks.

- [ ] Run `npm test -- --run`, `npm run typecheck`, `npm run build`, and `python -m pytest -q`.
- [ ] QA `http://127.0.0.1:5173/` at 1280×720: inspect all house roofs, tree tops, the Maker entrance, animal facing, and four representative interiors.
- [ ] Clear and inspect browser Console; require zero application errors and zero missing-frame warnings.
- [ ] Run `codegraph sync` and require `codegraph status` to report the index up to date.
