# GBA Village Door Navigation Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox syntax for tracking.

**Goal:** Replace the placeholder village with a cohesive CC0 16×16 top-down village whose Agents enter and leave every building through an explicit front door and prefer public roads over geometric shortcuts.

**Architecture:** Keep Phaser and the existing event/station pipeline. Add data-defined entrances and terrain costs, extend A* with weighted multi-leg paths, and give each Agent an explicit outside/inside presence state. Render the village from curated Puny World regions and directional Ninja Adventure sheets, while StatusOverlaySystem converts hidden inside Agents into building-level activity badges.

**Tech Stack:** TypeScript 5, Phaser 3, Vite 8, Vitest 4, Puny World 16×16 CC0 spritesheet, Ninja Adventure CC0 character sheets.

## Global Constraints

- First stage remains a fixed whole-village outdoor view; no explorable interior scene.
- Entering an explicit front door hides the Agent; leaving reveals it at the same threshold before movement.
- Building-to-building routes must traverse the source and destination doors and prefer visible public roads.
- Outdoor hook destinations keep Agents visible.
- Use only original-source CC0 assets; Aarya is reference-only and no Pokémon-derived asset may enter the repository.
- Preserve event ingress, clone limits, station capacity, retargeting, cancellation, overlays and the debug panel.
- Use nearest-neighbor integer scaling and one constrained village palette.

---

### Task 1: Vendor and document the curated CC0 assets

**Files:**
- Create: pixelworld_mvp/public/assets/puny-world/punyworld-overworld-tileset.png
- Create: pixelworld_mvp/public/assets/puny-world/LICENSE-CC0.txt
- Create: pixelworld_mvp/public/assets/ninja-adventure/ninja-blue.png
- Create: pixelworld_mvp/public/assets/ninja-adventure/samurai-blue.png
- Create: pixelworld_mvp/public/assets/ninja-adventure/samurai-green.png
- Create: pixelworld_mvp/public/assets/ninja-adventure/LICENSE-CC0.txt
- Create: pixelworld_mvp/public/assets/ASSET_SOURCES.md
- Modify: pixelworld_mvp/src/rendering/assetManifest.ts
- Test: pixelworld_mvp/tests/renderingContracts.test.ts

**Interfaces:**
- Produces: SpriteSheetAsset, WORLD_ATLAS, AGENT_ATLAS, AgentSkin and preloadVillageAssets(scene).
- Consumes: Phaser loader and Facing.

- [ ] **Step 1: Write the failing manifest test**

Assert the world atlas path is /assets/puny-world/punyworld-overworld-tileset.png; all three Agent sheets use /assets/ninja-adventure/; every sheet uses 16×16 frames; and no path contains pokemon, essentials, ruby, sapphire or rip.

- [ ] **Step 2: Verify the test fails**

Run: npm test -- renderingContracts.test.ts

Expected: FAIL because WORLD_ATLAS and AGENT_ATLAS do not exist.

- [ ] **Step 3: Download the exact original-source files**

Use https://opengameart.org/sites/default/files/punyworld-overworld-tileset.png and these official repository raw files:

    https://raw.githubusercontent.com/pixel-boy/NinjaAdventure/main/content/character/ninja_blue/sprite.png
    https://raw.githubusercontent.com/pixel-boy/NinjaAdventure/main/content/character/samurai_blue/sprite.png
    https://raw.githubusercontent.com/pixel-boy/NinjaAdventure/main/content/character/samurai_green/samurai_green.png

Download https://creativecommons.org/publicdomain/zero/1.0/legalcode.txt into each source directory. ASSET_SOURCES.md records creator, canonical page, direct file, CC0, retrieval date 2026-08-08, selected files and transformations.

- [ ] **Step 4: Implement spritesheet metadata**

Add:

    interface SpriteSheetAsset { key: string; path: string; frameWidth: number; frameHeight: number }
    interface AgentSkin { sheet: string; idleRow: 0; walkRows: readonly [0, 1, 2, 3] }

WORLD_ATLAS is key puny-world. AGENT_ATLAS maps main to ninja-blue, subagent to samurai-blue and branch to samurai-green. Load all with scene.load.spritesheet. Preserve only licensed work-prop images still used by the redesigned renderer.

- [ ] **Step 5: Verify and commit**

Run: npm test -- renderingContracts.test.ts
Run: npm test
Expected: PASS.

Commit: feat(pixelworld): vendor cohesive CC0 village assets

---

### Task 2: Define entrances, roads and a valid village topology

**Files:**
- Modify: pixelworld_mvp/src/world/types.ts
- Modify: pixelworld_mvp/src/world/worldDefinition.ts
- Modify: pixelworld_mvp/src/world/validateWorld.ts
- Create: pixelworld_mvp/tests/worldEntrances.test.ts
- Modify: pixelworld_mvp/tests/sceneryDefinition.test.ts

**Interfaces:**
- Produces: BuildingEntrance, TerrainKind, TerrainArea, WorldBuilding.entrance, WorldDefinition.terrain and walkableOverrides.
- Consumes: GridPoint, GridRect, stations and building IDs.

- [ ] **Step 1: Write failing topology tests**

For every building, assert outside.y equals bounds.y + bounds.height, threshold.y equals bounds.y + bounds.height - 1, the X coordinates match, outside belongs to road/plaza, and threshold is a walkable override. Assert validateWorld(WORLD_DEFINITION) returns no errors.

- [ ] **Step 2: Verify the tests fail**

Run: npm test -- worldEntrances.test.ts sceneryDefinition.test.ts

Expected: compile failure because entrance and terrain fields are absent.

- [ ] **Step 3: Add the schema**

Add BuildingEntrance with outside, threshold, entryFacing up and exitFacing down. Add TerrainKind road | plaza | grass and TerrainArea with kind, bounds and cost. Extend WorldBuilding with entrance and WorldDefinition with terrain and walkableOverrides.

- [ ] **Step 4: Replace the prototype layout**

Keep a 40×22 fixed world. Arrange three separated south-facing buildings across the north. Define a continuous east-west main road, three front paths, central plaza/spawn, south lounge path, west garden path and east repair path. Trees, water, fences and flowerbeds must shape but never overlap the road/door network. Building station slots remain logical capacity positions; outdoor slots remain visible walkable points.

- [ ] **Step 5: Harden validation**

Reject missing entrances, non-adjacent outside/threshold points, facade mismatches, outside tiles not on road/plaza, duplicate points, blocked walkable overrides and out-of-bounds doors.

- [ ] **Step 6: Verify and commit**

Run: npm test -- worldEntrances.test.ts sceneryDefinition.test.ts
Run: npm test
Run: npm run typecheck
Expected: PASS.

Commit: feat(pixelworld): define village roads and front doors

---

### Task 3: Add weighted and mandatory-waypoint A* routing

**Files:**
- Modify: pixelworld_mvp/src/navigation/navigationGrid.ts
- Modify: pixelworld_mvp/src/navigation/aStar.ts
- Modify: pixelworld_mvp/tests/aStar.test.ts
- Create: pixelworld_mvp/tests/villageRoutes.test.ts

**Interfaces:**
- Produces: NavigationGrid.costAt(point): number | undefined and findPathVia(grid, start, waypoints): GridPoint[] | null.
- Consumes: terrain, obstacles, entrances and walkable overrides.

- [ ] **Step 1: Write failing route tests**

Create a fixture whose shorter grass route costs more than a longer road route. For every ordered real-building pair, use source outside, target outside and target threshold as mandatory waypoints; assert they occur in order and no blocked tile occurs.

- [ ] **Step 2: Verify the shortcut failure**

Run: npm test -- aStar.test.ts villageRoutes.test.ts

Expected: FAIL because A* adds a uniform one and findPathVia is missing.

- [ ] **Step 3: Implement terrain costs**

Build a cost map: road/plaza/door cost 1, station apron cost 2, ordinary grass cost 5, and obstacles undefined. Apply obstacles first, then reopen declared walkableOverrides. Change tentative A* score to current score plus grid.costAt(neighbor).

- [ ] **Step 4: Implement waypoint concatenation**

findPathVia calls findPath for each consecutive segment, returns null if any segment fails, and removes duplicated junction points.

- [ ] **Step 5: Verify and commit**

Run: npm test -- aStar.test.ts villageRoutes.test.ts
Run: npm test
Run: npm run typecheck
Expected: PASS.

Commit: feat(pixelworld): prefer roads with weighted A star

---

### Task 4: Give Agents explicit outside and inside presence

**Files:**
- Create: pixelworld_mvp/src/agents/agentPresence.ts
- Modify: pixelworld_mvp/src/agents/AgentController.ts
- Modify: pixelworld_mvp/src/agents/AgentRegistry.ts
- Create: pixelworld_mvp/tests/agentBuildingTransit.test.ts
- Modify: pixelworld_mvp/tests/agentControllerCancel.test.ts

**Interfaces:**
- Produces: AgentPresence, AgentTravelPlan, AgentController.presence() and the extended dispatch travel-plan argument.
- Consumes: findPathVia, GridPoint, station assignments and PathFollower.

- [ ] **Step 1: Write failing lifecycle tests**

Cover outside-to-building, building-to-outside, building-to-building, same-building retarget and cancellation. Arrival must store inside/buildingId/threshold and hide the sprite. Departure must reveal at the old threshold and first cross the old outside point. Same-building events remain hidden. Failed paths preserve inside state. Cancellation never creates an impossible inside position.

- [ ] **Step 2: Verify failure**

Run: npm test -- agentBuildingTransit.test.ts agentControllerCancel.test.ts

Expected: FAIL because presence and AgentTravelPlan are missing.

- [ ] **Step 3: Add presence types**

    type AgentPresence =
      | { kind: 'outside' }
      | { kind: 'inside'; buildingId: string; threshold: GridPoint }

    interface AgentTravelPlan {
      waypoints: GridPoint[]
      destinationBuilding?: { buildingId: string; threshold: GridPoint }
      stayInside: boolean
    }

- [ ] **Step 4: Extend AgentController**

Compute a complete findPathVia result before changing visibility or presence. Successful inside departure positions the sprite at stored threshold, reveals it, marks outside and follows the old outside waypoint. Building arrival hides the sprite and stores destination presence. Use Ninja columns down=0, up=1, left=2, right=3; idle row 0 and walk rows 0–3 from a walk clock.

- [ ] **Step 5: Verify and commit**

Run: npm test -- agentBuildingTransit.test.ts agentControllerCancel.test.ts
Run: npm test
Run: npm run typecheck
Expected: PASS.

Commit: feat(pixelworld): model agent building presence

---

### Task 5: Plan door-constrained trips and synchronize occupancy

**Files:**
- Create: pixelworld_mvp/src/navigation/travelPlanner.ts
- Create: pixelworld_mvp/tests/travelPlanner.test.ts
- Modify: pixelworld_mvp/src/scenes/WorldScene.ts
- Modify: pixelworld_mvp/src/rendering/StatusOverlaySystem.ts
- Modify: pixelworld_mvp/src/status/buildingActivity.ts
- Modify: pixelworld_mvp/tests/worldSceneCloneReservations.test.ts
- Modify: pixelworld_mvp/tests/statusOverlayErrors.test.ts

**Interfaces:**
- Produces: planAgentTravel(world, presence, assignment): AgentTravelPlan and StatusOverlaySystem.setPresence(agentId, buildingId?).
- Consumes: entrances, presence/travel types, StationAllocator and event routes.

- [ ] **Step 1: Write failing planner and overlay tests**

Assert outside-to-building yields target outside then threshold; inside A to B yields A outside, B outside, B threshold; inside A to outdoor yields A outside then assignment point; inside A to another station in A sets stayInside. A building badge appears only after arrival. Hidden Agents have no individual chip/bubble. Clones emerge from Signal Station outside, never a wall.

- [ ] **Step 2: Verify direct-routing failure**

Run: npm test -- travelPlanner.test.ts worldSceneCloneReservations.test.ts statusOverlayErrors.test.ts

Expected: FAIL because dispatch targets assignment.point and there is no presence API.

- [ ] **Step 3: Implement pure travel planning**

Resolve station.buildingId through the matching building entrance. Prefix the old building outside point when current presence is inside. For outdoor stations use assignment.point. Set stayInside only when source and destination building IDs match.

- [ ] **Step 4: Integrate WorldScene**

Pass the travel plan to agent.dispatch. On successful departure clear overlay presence. Compose arrival callbacks to set target presence before existing clone behavior. Create a cloned Agent at Signal Station entrance.outside and visible.

- [ ] **Step 5: Separate activity and location**

publish updates action/text only. setPresence is the only API that changes AgentActivity.buildingId. update shows individual overlays only for outside Agents; inside Agents contribute solely to building aggregation.

- [ ] **Step 6: Verify and commit**

Run: npm test -- travelPlanner.test.ts worldSceneCloneReservations.test.ts statusOverlayErrors.test.ts
Run: npm test
Run: npm run typecheck
Expected: PASS.

Commit: feat(pixelworld): route agents through building doors

---

### Task 6: Render the cohesive Puny village and real door transitions

**Files:**
- Create: pixelworld_mvp/src/rendering/punyVillageAtlas.ts
- Create: pixelworld_mvp/src/rendering/VillageRenderer.ts
- Modify: pixelworld_mvp/src/scenes/WorldScene.ts
- Modify: pixelworld_mvp/src/rendering/buildingForeground.ts
- Modify: pixelworld_mvp/src/rendering/DepthOcclusionSystem.ts
- Modify: pixelworld_mvp/src/rendering/StatusOverlaySystem.ts
- Modify: pixelworld_mvp/src/styles.css
- Create: pixelworld_mvp/tests/villageRenderer.test.ts
- Modify: pixelworld_mvp/tests/buildingForeground.test.ts
- Modify: pixelworld_mvp/tests/depthOcclusion.test.ts

**Interfaces:**
- Produces: named Puny atlas regions, VillageRenderer.render(world): RenderedVillage, roof/canopy foregrounds and door-frame foregrounds.
- Consumes: atlas keys and redesigned world data.

- [ ] **Step 1: Write failing renderer contracts**

Assert named regions are 16-pixel aligned; every building has facade/roof/door regions; each door frame becomes a foreground; visible roads derive from world.terrain; and building shells contain no colored rectangle placeholder.

- [ ] **Step 2: Verify failure**

Run: npm test -- villageRenderer.test.ts buildingForeground.test.ts depthOcclusion.test.ts

Expected: FAIL because VillageRenderer and named regions do not exist.

- [ ] **Step 3: Define and inspect curated Puny regions**

Name grass variants, dirt centers/edges, water centers/edges, tree trunks/canopies, flowers/rocks/fences, three house color variants, doors and signboards. Every source rectangle must use integer 16-pixel coordinates. Use the source sheet directly with Phaser crop frames; never resample or smooth it.

- [ ] **Step 4: Render in strict layers**

Order: grass; roads/plaza; water/decorations; walls/thresholds; trunks/work-zone accents; Agents by foot Y; roofs/canopies/door frames by baseline; signboards/status overlays. Return all real occluder bounds from VillageRenderer.

- [ ] **Step 5: Remove procedural placeholders**

Delete rectangle building bodies and hard-coded pathRects from WorldScene. Call VillageRenderer once during create. Keep foreground cleanup/debug overlays. Use small facade signboards instead of large floating English labels.

- [ ] **Step 6: Tune in browser**

At 1280×720, doors must be obvious without labels, all front paths meet the public road, roofs never cover the door, Agents pass under a door frame before hiding, and Ninja actors fit the Puny palette. At 840×480, preserve full-village visibility and the collapsed panel toggle.

- [ ] **Step 7: Verify and commit**

Run: npm test -- villageRenderer.test.ts buildingForeground.test.ts depthOcclusion.test.ts
Run: npm test
Run: npm run typecheck
Run: npm run build
Expected: PASS; the existing Phaser bundle-size warning is non-blocking.

Commit: feat(pixelworld): render a cohesive GBA style village

---

### Task 7: Preserve every hook and prove the complete stage

**Files:**
- Modify: pixelworld_mvp/src/events/behaviorRouter.ts
- Modify: pixelworld_mvp/src/ui/demoEvents.ts
- Modify: pixelworld_mvp/src/ui/TestPanel.ts
- Modify: pixelworld_mvp/tests/behaviorRouter.test.ts
- Create: pixelworld_mvp/tests/villageSystemAcceptance.test.ts
- Modify: pixelworld_mvp/README.md

**Interfaces:**
- Produces: final hook-to-place mapping and acceptance proof.
- Consumes: all prior task interfaces.

- [ ] **Step 1: Write end-to-end system tests**

Sequence: edit enters Build Workshop and hides; tool exits that door, follows roads and enters Signal Station; think travels through Knowledge Hall door; idle exits to lounge lawn; blocked stays visible at repair/queue apron; clone emerges from Signal Station door and the eleventh Subagent is rejected; heartbeat preserves presence and location.

- [ ] **Step 2: Verify mappings**

Run: npm test -- behaviorRouter.test.ts villageSystemAcceptance.test.ts

Expected: PASS after every destination ID matches the redesigned stations.

- [ ] **Step 3: Update panel and README**

Keep every button. Add a compact presence readout: outdoor or inside the named building. Document door/road debug behavior, asset provenance, fixed view, no-interior first stage and the run command.

- [ ] **Step 4: Execute browser acceptance**

At 1280×720 and 840×480 click every action; enable paths, blocked tiles and anchors; verify all three entry/exit transitions and road preference; put at least three Agents in different buildings; verify building badges and outdoor bubbles; inspect asset network responses; finish with no application console error.

- [ ] **Step 5: Run final verification**

From pixelworld_mvp run npm test, npm run typecheck and npm run build. From repository root run python -m pytest -q, git diff --check, codegraph sync and codegraph status.

Expected: all pass and CodeGraph reports up to date.

- [ ] **Step 6: Commit and review**

Commit: test(pixelworld): accept GBA village door workflow

Package the complete range from 12375d6 to final HEAD for senior review. Completion requires zero Critical and zero Important findings, a reachable running URL, successful browser door evidence and current CodeGraph.

