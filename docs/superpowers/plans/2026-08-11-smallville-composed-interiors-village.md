# Smallville-style Composed Interiors and Village Density Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace sparse default rooms and grid-like outdoor space with editable layered furniture vignettes and a denser Smallville-inspired fixed-view village, then verify and push the feature branch.

**Architecture:** Keep `FurnitureDefinition` as the editable primitive and author clusters by sharing anchors across `furniture` and `surface` layers. Migrate old authored defaults to revision 2 while preserving custom items. Keep the 48×28 world and derive a richer connected road graph and scenery from `worldDefinition.ts`.

**Tech Stack:** TypeScript, Phaser 3, Vitest, Vite, CodeGraph, gstack browse.

## Global Constraints

- Use only the existing licensed Modern Office Revamped v1.2 and Serene Village assets.
- Preserve fixed global village camera, all 12 Hook buildings, A* entrance reachability, furniture editing, Hook routing, and saved DIY additions.
- Surface accessories do not block navigation; Hook furniture remains independently selectable and functional.
- Do not enlarge the 48×28 world.

---

### Task 1: Layered authored interior presets

**Files:**
- Modify: `pixelworld_mvp/src/world/interiorDefinitions.ts`
- Test: `pixelworld_mvp/tests/interiorDefinitions.test.ts`

**Interfaces:**
- Produces: `INTERIOR_LAYOUT_REVISION`, layered `INTERIOR_DEFINITIONS` presets using Modern Office asset IDs.
- Consumes: existing `FurnitureDefinition`, `FurnitureLayer`, and Hook action types.

- [ ] **Step 1: Write failing composition tests**

Assert every theme contains at least one shared-anchor furniture/surface pair, every surface pair has `blocksNavigation: false`, and all pre-existing supported Hook actions remain represented.

- [ ] **Step 2: Run the focused test**

Run: `npm test -- --run tests/interiorDefinitions.test.ts`

Expected: FAIL because defaults do not yet author layered furniture compositions.

- [ ] **Step 3: Implement authored furniture options and room clusters**

Extend the local `furniture(...)` helper with an options object containing `assetId`, `scale`, `rotation`, `layer`, `zIndex`, `blocksNavigation`, and `footprint`. Arrange Rest, Research, Maker, and Collaboration rooms into perimeter storage, central activity, and desk/equipment/chair clusters. Export `INTERIOR_LAYOUT_REVISION = 2`.

- [ ] **Step 4: Run focused interior tests**

Run: `npm test -- --run tests/interiorDefinitions.test.ts tests/interiorAssignment.test.ts tests/interiorMotion.test.ts tests/validateWorld.test.ts`

Expected: all selected tests PASS.

- [ ] **Step 5: Commit the room composition**

```bash
git add pixelworld_mvp/src/world/interiorDefinitions.ts pixelworld_mvp/tests/interiorDefinitions.test.ts
git commit -m "feat: compose layered Smallville-style interiors"
```

### Task 2: Preserve DIY items through the preset revision

**Files:**
- Modify: `pixelworld_mvp/src/rendering/interiorLayoutEditor.ts`
- Test: `pixelworld_mvp/tests/interiorLayoutEditor.test.ts`

**Interfaces:**
- Consumes: `INTERIOR_LAYOUT_REVISION` and the room's authored furniture IDs.
- Produces: saved layout version 5 with `authoredRevision`; `migrateAuthoredLayout(room, source)` behavior.

- [ ] **Step 1: Write failing migration tests**

Store a version-4 layout containing an old authored item and a `custom-office-*` item. Assert loading returns the revision-2 authored preset plus the custom item, while a version-5 revision-2 save round-trips exactly.

- [ ] **Step 2: Run the focused persistence test**

Run: `npm test -- --run tests/interiorLayoutEditor.test.ts`

Expected: FAIL because version 5 and authored revision migration do not exist.

- [ ] **Step 3: Implement versioned migration**

Save `{ version: 5, authoredRevision: 2, furniture }`. When loading legacy version 2–4 data, replace authored stock items with the current room preset and append only legacy custom items whose IDs are not authored IDs. Continue accepting valid older data without throwing.

- [ ] **Step 4: Run focused editor and prefab tests**

Run: `npm test -- --run tests/interiorLayoutEditor.test.ts tests/interiorPrefabStore.test.ts tests/interiorSelection.test.ts`

Expected: all selected tests PASS.

- [ ] **Step 5: Commit migration**

```bash
git add pixelworld_mvp/src/rendering/interiorLayoutEditor.ts pixelworld_mvp/tests/interiorLayoutEditor.test.ts
git commit -m "feat: migrate saved rooms to composed presets"
```

### Task 3: Dense connected outdoor village

**Files:**
- Modify: `pixelworld_mvp/src/world/worldDefinition.ts`
- Test: `pixelworld_mvp/tests/worldDefinition.test.ts`
- Test: `pixelworld_mvp/tests/worldEntrances.test.ts`

**Interfaces:**
- Produces: connected road/plaza terrain, clustered trees and decorations, unchanged building and station IDs.
- Consumes: `lineH`, `lineV`, `rectPoints`, `terrainCells`, current river/bridge geometry.

- [ ] **Step 1: Write failing density and connectivity tests**

Assert road/plaza coverage exceeds the current baseline, every building outside/threshold lies on or directly touches traversable street terrain, there are at least three distinct scenery clusters in each map third, and all building entrances remain reachable from spawn.

- [ ] **Step 2: Run world tests**

Run: `npm test -- --run tests/worldDefinition.test.ts tests/worldEntrances.test.ts tests/aStar.test.ts`

Expected: the new density assertions FAIL against the current sparse grid.

- [ ] **Step 3: Re-author roads and scenery**

Add two-tile neighborhood street segments, door approaches, river walk, farm lane, plaza connectors, orchard/park tree clusters, and street-edge props. Keep entrances, fields, bridge cells, and all station coordinates valid.

- [ ] **Step 4: Run world and rendering tests**

Run: `npm test -- --run tests/worldDefinition.test.ts tests/worldEntrances.test.ts tests/aStar.test.ts tests/villageRenderer.test.ts tests/validateWorld.test.ts`

Expected: all selected tests PASS.

- [ ] **Step 5: Commit village composition**

```bash
git add pixelworld_mvp/src/world/worldDefinition.ts pixelworld_mvp/tests/worldDefinition.test.ts pixelworld_mvp/tests/worldEntrances.test.ts
git commit -m "feat: enrich the connected agent village"
```

### Task 4: Visual QA, integration, and push

**Files:**
- Modify only if QA exposes a defect in files already listed above.

**Interfaces:**
- Produces: verified feature branch pushed to its configured remote.

- [ ] **Step 1: Run complete automated verification**

Run: `npm test -- --run && npm run build`

Expected: zero failing tests and successful Vite production build.

- [ ] **Step 2: Run the application and browser QA**

Start `npm run dev -- --host 127.0.0.1 --port 5173`. Capture the full village and all four room themes at 1280×720. Verify stacked desk/equipment alignment, readable movement space, edit controls, no clipped scenery, and no console/network errors.

- [ ] **Step 3: Sync code intelligence**

Run: `codegraph sync . && codegraph status .`

Expected: `Index is up to date`.

- [ ] **Step 4: Review and push**

Run: `git diff --check`, inspect commits against the base, then `git push -u origin feat/pixelworld-work-village-mvp`.

Expected: push succeeds and local HEAD matches the remote tracking branch.
