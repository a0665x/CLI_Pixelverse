# RPG Village Motion Upgrade Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a larger, cohesive eight-building RPG Agent village with 1.5x presentation, sharp status text, and observable door-to-furniture interior motion.

**Architecture:** Preserve the existing Phaser world, A* travel, event ingress, and fixed camera. Add a LimeZu asset adapter, expand the data-driven world/station definitions, introduce a pure `interiorMotion` state machine, and let the cutaway render that state while DOM overlays provide resolution-independent copy.

**Tech Stack:** TypeScript, Phaser 3, Vite, Vitest, CSS/DOM, LimeZu Serene Village Revamped and Modern Interiors Free.

## Global Constraints

- No Nintendo/Game Freak extracted assets.
- Serene Village Revamped attribution is mandatory under CC BY 4.0.
- Modern Interiors Free is prototype-only and must be labeled as such in attribution.
- The world remains a fixed global observation view; no follow camera.
- Source pixel art is rendered with nearest-neighbor filtering at 1.5x scale.
- Existing hook event kinds and test-panel controls remain functional.

---

### Task 1: Curated LimeZu asset adapter

**Files:**
- Create: `pixelworld_mvp/public/assets/limezu/serene-village/*`
- Create: `pixelworld_mvp/public/assets/limezu/modern-interiors-free/*`
- Modify: `pixelworld_mvp/src/rendering/assetManifest.ts`
- Modify: `pixelworld_mvp/public/assets/ASSET_SOURCES.md`
- Modify: `pixelworld_mvp/ATTRIBUTION.md`
- Test: `pixelworld_mvp/tests/assetManifest.test.ts`

**Interfaces:**
- Produces: `SERENE_VILLAGE_ASSETS` and `MODERN_INTERIOR_ASSETS` image manifests.

- [ ] Write failing assertions for the new manifests and official source/license metadata.
- [ ] Run `npm test -- --run tests/assetManifest.test.ts` and confirm missing exports fail.
- [ ] Extract only the required official spritesheets/animations, add manifests and attribution.
- [ ] Re-run the focused test and confirm it passes.

### Task 2: Eight-destination RPG village

**Files:**
- Modify: `pixelworld_mvp/src/world/types.ts`
- Modify: `pixelworld_mvp/src/world/worldDefinition.ts`
- Modify: `pixelworld_mvp/src/events/behaviorRouter.ts`
- Modify: `pixelworld_mvp/src/rendering/VillageRenderer.ts`
- Modify: `pixelworld_mvp/src/rendering/zoneLabels.ts`
- Test: `pixelworld_mvp/tests/villageRoutes.test.ts`
- Test: `pixelworld_mvp/tests/villageRenderer.test.ts`
- Test: `pixelworld_mvp/tests/villageSystemAcceptance.test.ts`

**Interfaces:**
- Consumes: LimeZu exterior manifest.
- Produces: eight `WorldBuilding` records and hook-to-station routes.

- [ ] Write failing tests for eight buildings, unique connected doors, all hook destinations, and 1.5x render scale.
- [ ] Run the focused tests and verify requirement-level failures.
- [ ] Expand the map, stations, roads, scenery, houses, and Serene render commands.
- [ ] Re-run the focused tests and keep existing A* route tests green.

### Task 3: Observable interior motion

**Files:**
- Create: `pixelworld_mvp/src/rendering/interiorMotion.ts`
- Modify: `pixelworld_mvp/src/agents/AgentController.ts`
- Modify: `pixelworld_mvp/src/rendering/interiorAssignment.ts`
- Modify: `pixelworld_mvp/src/rendering/InteriorCutawaySystem.ts`
- Modify: `pixelworld_mvp/src/world/interiorDefinitions.ts`
- Test: `pixelworld_mvp/tests/interiorMotion.test.ts`
- Test: `pixelworld_mvp/tests/interiorCutawaySystem.test.ts`

**Interfaces:**
- Produces: `interiorMotionAt(snapshot, interior, assignment, now)` returning `phase`, `point`, `facing`, `bob`, and `bubbleText`.

- [ ] Write failing tests for door spawn, progressive ingress, furniture loop, and breathing bob.
- [ ] Run focused tests and verify failures are caused by the absent planner.
- [ ] Implement the pure planner and extend snapshots with interior-entry time.
- [ ] Render stable occupant objects that tween between motion points instead of recreating teleported sprites.
- [ ] Re-run the focused tests.

### Task 4: Sharp status presentation and verification

**Files:**
- Modify: `pixelworld_mvp/index.html`
- Modify: `pixelworld_mvp/src/styles.css`
- Modify: `pixelworld_mvp/src/rendering/StatusOverlaySystem.ts`
- Modify: `pixelworld_mvp/src/ui/TestPanel.ts`
- Test: `pixelworld_mvp/tests/gameConfig.test.ts`
- Test: `pixelworld_mvp/tests/testPanelPresence.test.ts`

**Interfaces:**
- Consumes: Agent activity and presence snapshots.
- Produces: readable high-resolution village/cutaway status copy.

- [ ] Write failing tests for presentation scale and persistent activity copy.
- [ ] Run focused tests and confirm failures.
- [ ] Apply responsive canvas sizing, nearest-neighbor rendering, larger panel typography, and persistent bubbles.
- [ ] Run `npm test -- --run`, `npm run typecheck`, and `npm run build`.
- [ ] Run browser QA at desktop and compact viewports, exercise web/tool/idle flows, and inspect console/network output.
- [ ] Run `codegraph sync` and confirm `codegraph status` is current.

