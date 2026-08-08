# Themed Village Interior Cutaway Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the repeated northern building blocks with a dispersed four-house GBA-style village and add clickable, live pixel-art interior cutaways whose furniture and Agent poses reflect hook activity.

**Architecture:** Keep `WorldScene` as the lifecycle owner and extend `WorldDefinition` with declarative house themes, river/bridge scenery, and ambient animals. `VillageRenderer` returns building hit regions; a new `InteriorCutawaySystem` renders a read-only projection of existing Agent state in the same Phaser canvas, while `AmbientAnimalSystem` animates non-blocking village life independently of A*.

**Tech Stack:** TypeScript 7, Phaser 3.90, Vite 8, Vitest 4, CC0 Puny World/Ninja Adventure/Kenney raster assets, nearest-neighbor rendering.

## Global Constraints

- Keep the fixed 40×22 tile global camera and integer nearest-neighbor scaling.
- Render exactly four distinct houses, each 4–6 tiles wide and separated by at least four clear tiles.
- Every building trip must exit and enter through its visible front door; river crossings must use a bridge.
- Clicking any house opens the cutaway; opening or closing it must not mutate camera, routing, presence, station allocation, Agent count, or selection.
- At viewport widths of 940 px and above use a 480×288 internal cutaway; below 940 px use the available 608×320 internal canvas with a 16 px margin.
- Interior Agents are visual projections assigned to deterministic furniture/overflow anchors, not duplicate controllers.
- Use only original-source CC0 assets and document source URL, license, retrieval date, selected files, and palette changes.
- Do not add explorable interior pathfinding in this phase.

---

## File Structure

- `pixelworld_mvp/src/world/types.ts`: shared exterior, interior, furniture, and animal definitions.
- `pixelworld_mvp/src/world/worldDefinition.ts`: the four-house map, hook stations, river, bridges, pasture, and theme IDs.
- `pixelworld_mvp/src/world/interiorDefinitions.ts`: four themed room layouts and action-to-furniture anchors.
- `pixelworld_mvp/src/world/validateWorld.ts`: topology, theme, bridge, and furniture validation.
- `pixelworld_mvp/src/rendering/punyVillageAtlas.ts`: curated Puny regions and four exterior palettes.
- `pixelworld_mvp/src/rendering/VillageRenderer.ts`: dispersed village, distinct house templates, scenery commands, and clickable hit regions.
- `pixelworld_mvp/src/rendering/InteriorCutawaySystem.ts`: overlay transition, roof reveal, furniture, occupants, icons, and close lifecycle.
- `pixelworld_mvp/src/rendering/interiorAssignment.ts`: pure deterministic Agent-to-furniture assignment.
- `pixelworld_mvp/src/rendering/AmbientAnimalSystem.ts`: deterministic animal patrol/graze animation.
- `pixelworld_mvp/src/rendering/assetManifest.ts`: preload curated CC0 tiles and expose texture keys.
- `pixelworld_mvp/src/scenes/WorldScene.ts`: own and update the renderer hit areas, cutaway, and animals.
- `pixelworld_mvp/src/events/behaviorRouter.ts`: route each hook to the intended themed house or outdoor zone.
- `pixelworld_mvp/public/assets/kenney/tiny-farm/*`: named animal and farm PNG cells copied from the official CC0 archive.
- `pixelworld_mvp/public/assets/kenney/roguelike-rpg/*`: named room furniture PNG cells copied from the official CC0 archive.
- `pixelworld_mvp/public/assets/kenney/modern-city/*`: named computer, television, and radio PNG cells copied from the official CC0 archive.
- `pixelworld_mvp/public/assets/ASSET_SOURCES.md`: exact provenance and palette notes.

### Task 1: Declarative village and interior domain model

**Files:**
- Modify: `pixelworld_mvp/src/world/types.ts`
- Create: `pixelworld_mvp/src/world/interiorDefinitions.ts`
- Modify: `pixelworld_mvp/src/world/worldDefinition.ts`
- Modify: `pixelworld_mvp/src/world/validateWorld.ts`
- Modify: `pixelworld_mvp/tests/validateWorld.test.ts`
- Modify: `pixelworld_mvp/tests/sceneryDefinition.test.ts`
- Modify: `pixelworld_mvp/tests/worldEntrances.test.ts`
- Modify: `pixelworld_mvp/tests/behaviorRouter.test.ts`

**Interfaces:**
- Produces: `BuildingThemeId`, `FurnitureKind`, `ActivityIconKind`, `InteriorDefinition`, `AmbientAnimalDefinition`, `WorldBuilding.themeId`, and river/bridge scenery consumed by Tasks 2–6.
- Preserves: existing `WorldDefinition`, `StationDefinition`, and `BuildingEntrance` callers through additive fields and exact station IDs.

- [ ] **Step 1: Write failing world-contract tests**

```ts
expect(WORLD_DEFINITION.buildings.map(({ themeId }) => themeId)).toEqual([
  'rest-cabin', 'research-library', 'maker-workshop', 'collaboration-barn',
]);
expect(WORLD_DEFINITION.scenery.river.length).toBeGreaterThan(0);
expect(WORLD_DEFINITION.scenery.bridges).toHaveLength(2);
expect(INTERIOR_DEFINITIONS['rest-cabin'].furniture.some(({ kind }) => kind === 'sofa')).toBe(true);
expect(INTERIOR_DEFINITIONS['research-library'].furniture.some(({ kind }) => kind === 'computer')).toBe(true);
```

- [ ] **Step 2: Run the focused tests and confirm they fail**

Run: `npm test -- --run tests/validateWorld.test.ts tests/sceneryDefinition.test.ts tests/worldEntrances.test.ts tests/behaviorRouter.test.ts`

Expected: FAIL because theme, river, bridge, and interior definitions do not exist.

- [ ] **Step 3: Add exact shared types and four interior definitions**

```ts
export type BuildingThemeId = 'rest-cabin' | 'research-library' | 'maker-workshop' | 'collaboration-barn';
export type FurnitureKind = 'sofa' | 'television' | 'bed' | 'bookcase' | 'computer' | 'map-table' | 'planning-board' | 'reading-desk' | 'workbench' | 'tool-wall' | 'repair-table' | 'dispatch-pod' | 'radio-console' | 'response-desk' | 'meeting-table' | 'decor';
export type ActivityIconKind = 'rest' | 'offline' | 'think' | 'plan' | 'read' | 'web' | 'edit' | 'tool' | 'repair' | 'clone' | 'respond' | 'generic';
export interface FurnitureDefinition { id: string; kind: FurnitureKind; point: GridPoint; facing: Facing; supportedActions: AgentAction[]; icon: ActivityIconKind; }
export interface InteriorDefinition { id: BuildingThemeId; label: string; width: number; height: number; floor: 'wood' | 'tile'; wall: 'cream' | 'blue' | 'brick' | 'green'; furniture: FurnitureDefinition[]; overflow: GridPoint[]; }
export interface AmbientAnimalDefinition { id: string; species: 'cow' | 'sheep' | 'chicken' | 'pig'; patrolBounds: GridRect; start: GridPoint; speed: number; }
```

Define all four room themes with at least one compatible anchor for every routed action and two overflow points per room.

- [ ] **Step 4: Replace the old three-building row with the dispersed four-house map**

Use unique IDs `rest-cabin`, `research-library`, `maker-workshop`, and `collaboration-barn`; keep one `entryFacing: 'up'` threshold per house. Declare a winding river, two walkable bridges, pasture/crop rectangles, animal patrol bounds, and obstacle rectangles that exclude bridge and threshold cells. Route `idle/offline` to Rest, `think/plan/read/web` to Research, `edit/tool/self_heal` to Maker, `clone/respond` to Collaboration, and keep arrival/await/blocked outdoors.

- [ ] **Step 5: Extend validation with exact invariants**

```ts
if (!INTERIOR_DEFINITIONS[building.themeId]) errors.push(`missing interior theme: ${building.themeId}`);
if (building.bounds.width < 4 || building.bounds.width > 6) errors.push(`building width out of range: ${building.id}`);
if (riverKeys.has(pointKey(bridge)) && !overrideKeys.has(pointKey(bridge))) errors.push(`bridge is not walkable: ${pointKey(bridge)}`);
```

Also reject overlapping houses, less than four clear tiles between house bounds, animal starts outside patrol bounds, and interior actions without a compatible furniture anchor.

- [ ] **Step 6: Run focused and full tests**

Run: `npm test -- --run tests/validateWorld.test.ts tests/sceneryDefinition.test.ts tests/worldEntrances.test.ts tests/behaviorRouter.test.ts`

Expected: PASS.

Run: `npm test`

Expected: existing tests may fail only where they assert the superseded three-house IDs/layout; update those assertions in this task and finish with PASS.

- [ ] **Step 7: Commit**

```bash
git add pixelworld_mvp/src/world pixelworld_mvp/src/events/behaviorRouter.ts pixelworld_mvp/tests
git commit -m "feat(pixelworld): define themed riverside village"
```

### Task 2: Curated CC0 asset pipeline

**Files:**
- Create: `pixelworld_mvp/public/assets/kenney/tiny-farm/cow.png`
- Create: `pixelworld_mvp/public/assets/kenney/tiny-farm/sheep.png`
- Create: `pixelworld_mvp/public/assets/kenney/tiny-farm/chicken.png`
- Create: `pixelworld_mvp/public/assets/kenney/tiny-farm/pig.png`
- Create: `pixelworld_mvp/public/assets/kenney/roguelike-rpg/sofa.png`
- Create: `pixelworld_mvp/public/assets/kenney/roguelike-rpg/bed.png`
- Create: `pixelworld_mvp/public/assets/kenney/roguelike-rpg/bookcase.png`
- Create: `pixelworld_mvp/public/assets/kenney/roguelike-rpg/table.png`
- Create: `pixelworld_mvp/public/assets/kenney/roguelike-rpg/workbench.png`
- Create: `pixelworld_mvp/public/assets/kenney/modern-city/television.png`
- Create: `pixelworld_mvp/public/assets/kenney/modern-city/computer.png`
- Create: `pixelworld_mvp/public/assets/kenney/modern-city/radio.png`
- Create: `pixelworld_mvp/public/assets/kenney/tiny-farm/LICENSE.txt`
- Create: `pixelworld_mvp/public/assets/kenney/roguelike-rpg/LICENSE.txt`
- Create: `pixelworld_mvp/public/assets/kenney/modern-city/LICENSE.txt`
- Modify: `pixelworld_mvp/public/assets/ASSET_SOURCES.md`
- Modify: `pixelworld_mvp/src/rendering/assetManifest.ts`
- Create: `pixelworld_mvp/tests/assetManifest.test.ts`

**Interfaces:**
- Produces: `ANIMAL_ASSETS`, `INTERIOR_ASSETS`, and `preloadVillageAssets()` registrations used by Tasks 3 and 5.
- Consumes: official Kenney Tiny Farm, Roguelike/RPG, and Roguelike Modern City archives only.

- [ ] **Step 1: Write a failing manifest contract test**

```ts
expect(ANIMAL_ASSETS.cow.path).toBe('/assets/kenney/tiny-farm/cow.png');
expect(INTERIOR_ASSETS.computer.path).toBe('/assets/kenney/modern-city/computer.png');
expect(Object.values(ANIMAL_ASSETS).every(({ frameWidth, frameHeight }) => frameWidth === 16 && frameHeight === 16)).toBe(true);
```

- [ ] **Step 2: Run and confirm failure**

Run: `npm test -- --run tests/assetManifest.test.ts`

Expected: FAIL because the exports do not exist.

- [ ] **Step 3: Download official archives and curate only named source cells**

Download from the official Kenney asset pages linked in the approved spec, preserve each archive license, inspect tiles at original resolution, and copy the selected 16×16 cells to the semantic filenames above without resampling. If a modern-city source is larger than 16×16, crop on source pixel boundaries into the semantic 16×16 output rather than scaling.

- [ ] **Step 4: Register exact textures**

```ts
export const ANIMAL_ASSETS = {
  cow: { key: 'animal-cow', path: '/assets/kenney/tiny-farm/cow.png', frameWidth: 16, frameHeight: 16 },
  sheep: { key: 'animal-sheep', path: '/assets/kenney/tiny-farm/sheep.png', frameWidth: 16, frameHeight: 16 },
  chicken: { key: 'animal-chicken', path: '/assets/kenney/tiny-farm/chicken.png', frameWidth: 16, frameHeight: 16 },
  pig: { key: 'animal-pig', path: '/assets/kenney/tiny-farm/pig.png', frameWidth: 16, frameHeight: 16 },
} as const;
```

Add equivalent `INTERIOR_ASSETS`, and load single PNG cells with `scene.load.image` while retaining sprite sheets for Agents and Puny World.

- [ ] **Step 5: Record provenance**

Document official page, direct archive URL, `CC0 1.0`, retrieval date `2026-08-08`, original file/cell for every semantic output, and any exact color replacement pairs. Explicitly state that no Nintendo/Game Freak or fan-game rip was used.

- [ ] **Step 6: Verify and commit**

Run: `npm test -- --run tests/assetManifest.test.ts`

Expected: PASS.

Run: `file public/assets/kenney/tiny-farm/*.png public/assets/kenney/roguelike-rpg/*.png public/assets/kenney/modern-city/*.png`

Expected: every curated output is a PNG image with 16×16 geometry.

```bash
git add pixelworld_mvp/public/assets pixelworld_mvp/src/rendering/assetManifest.ts pixelworld_mvp/tests/assetManifest.test.ts
git commit -m "feat(pixelworld): add curated CC0 village assets"
```

### Task 3: Distinct exteriors, river, bridges, fields, and hit regions

**Files:**
- Modify: `pixelworld_mvp/src/rendering/punyVillageAtlas.ts`
- Modify: `pixelworld_mvp/src/rendering/VillageRenderer.ts`
- Modify: `pixelworld_mvp/tests/villageRenderer.test.ts`
- Modify: `pixelworld_mvp/tests/renderingContracts.test.ts`
- Modify: `pixelworld_mvp/tests/villageRoutes.test.ts`

**Interfaces:**
- Consumes: `WorldBuilding.themeId`, river/bridge/pasture/crop data from Task 1.
- Produces: `BuildingHitRegion { buildingId: string; bounds: Phaser.Geom.Rectangle; object: Phaser.GameObjects.Zone }[]` on `RenderedVillage` for Task 5.

- [ ] **Step 1: Write failing render-plan tests**

```ts
const plan = buildVillageRenderPlan(WORLD_DEFINITION);
expect(new Set(plan.buildingTiles.map(({ buildingId }) => buildingId))).toEqual(new Set(WORLD_DEFINITION.buildings.map(({ id }) => id)));
expect(plan.commands.filter(({ buildingRole }) => buildingRole === 'door')).toHaveLength(4);
expect(plan.commands.some(({ sceneryRole }) => sceneryRole === 'bridge')).toBe(true);
expect(plan.hitRegions.map(({ buildingId }) => buildingId)).toEqual(WORLD_DEFINITION.buildings.map(({ id }) => id));
```

- [ ] **Step 2: Run and confirm failure**

Run: `npm test -- --run tests/villageRenderer.test.ts tests/renderingContracts.test.ts tests/villageRoutes.test.ts`

Expected: FAIL because the old renderer repeats roof/wall fills and exposes no hit regions.

- [ ] **Step 3: Replace rectangle filling with four named house templates**

Define template commands for warm cottage, blue library, brick workshop, and green barn. Each template uses one coherent roof mass, a visually centered door matching `entrance.threshold`, windows/porch/side props, and distinct roof/sign details. Add `sceneryRole?: 'river' | 'bridge' | 'crop' | 'pasture' | 'fence' | 'prop'` and emit scenery from definition data.

- [ ] **Step 4: Return interactive hit regions**

```ts
export interface BuildingHitRegion { buildingId: string; bounds: Phaser.Geom.Rectangle; object: Phaser.GameObjects.Zone; }
export interface RenderedVillage { foregrounds: RenderedForeground[]; roadTiles: GridPoint[]; buildingTiles: AtlasTileCommand[]; hitRegions: BuildingHitRegion[]; }
```

Create one transparent Phaser zone per full house footprint with `setInteractive({ useHandCursor: true })`; do not attach behavior inside the renderer.

- [ ] **Step 5: Verify routes and visual contracts**

Run: `npm test -- --run tests/villageRenderer.test.ts tests/renderingContracts.test.ts tests/villageRoutes.test.ts`

Expected: PASS, including cross-river routes whose water coordinates occur only where declared as bridge overrides.

- [ ] **Step 6: Commit**

```bash
git add pixelworld_mvp/src/rendering/punyVillageAtlas.ts pixelworld_mvp/src/rendering/VillageRenderer.ts pixelworld_mvp/tests
git commit -m "feat(pixelworld): render a dispersed riverside village"
```

### Task 4: Ambient animal life

**Files:**
- Create: `pixelworld_mvp/src/rendering/AmbientAnimalSystem.ts`
- Create: `pixelworld_mvp/tests/ambientAnimalSystem.test.ts`
- Modify: `pixelworld_mvp/src/scenes/WorldScene.ts`

**Interfaces:**
- Consumes: `AmbientAnimalDefinition[]` and `ANIMAL_ASSETS`.
- Produces: `update(deltaMs): void` and `destroy(): void`; no NavigationGrid or StationAllocator dependency.

- [ ] **Step 1: Write deterministic patrol tests**

```ts
const next = advanceAnimal({ point: { x: 5, y: 5 }, targetIndex: 0, idleMs: 0 }, definition, 1_000);
expect(pointInsideRect(next.point, definition.patrolBounds)).toBe(true);
expect('navigationGrid' in next).toBe(false);
```

Also test identical inputs yield identical outputs and destroy removes all sprites.

- [ ] **Step 2: Run and confirm failure**

Run: `npm test -- --run tests/ambientAnimalSystem.test.ts`

Expected: FAIL because the module does not exist.

- [ ] **Step 3: Implement deterministic graze/patrol motion**

Use a fixed loop derived from patrol rectangle corners/center, speeds from `AmbientAnimalDefinition`, 400–900 ms deterministic graze pauses, horizontal flip by velocity, and depth `sprite.y + 0.01`. Clamp every result to patrol bounds.

- [ ] **Step 4: Own the system from WorldScene**

Instantiate after village rendering, call `update(delta)` after Agent updates, and destroy it during shutdown. Do not pass `navigationGrid`, `allocator`, or Agent registry to the constructor.

- [ ] **Step 5: Verify and commit**

Run: `npm test -- --run tests/ambientAnimalSystem.test.ts`

Expected: PASS.

```bash
git add pixelworld_mvp/src/rendering/AmbientAnimalSystem.ts pixelworld_mvp/src/scenes/WorldScene.ts pixelworld_mvp/tests/ambientAnimalSystem.test.ts
git commit -m "feat(pixelworld): animate village animals"
```

### Task 5: Pure interior occupant assignment

**Files:**
- Create: `pixelworld_mvp/src/rendering/interiorAssignment.ts`
- Create: `pixelworld_mvp/tests/interiorAssignment.test.ts`
- Modify: `pixelworld_mvp/src/agents/AgentController.ts`

**Interfaces:**
- Consumes: `InteriorDefinition` and read-only `InteriorAgentSnapshot { agentId; role; buildingId; action; eventKind }`.
- Produces: `assignInteriorOccupants(interior, agents): InteriorOccupantAssignment[]` with stable, non-overlapping points and furniture IDs.

- [ ] **Step 1: Write failing assignment tests**

```ts
expect(assignInteriorOccupants(rest, [idle])[0]).toMatchObject({ furnitureId: 'rest-sofa', icon: 'rest' });
expect(assignInteriorOccupants(research, [web])[0]?.furnitureId).toMatch(/^research-(computer|bookcase)/);
expect(new Set(assignInteriorOccupants(research, threeWebAgents).map(({ point }) => `${point.x},${point.y}`)).size).toBe(3);
```

Test deterministic web alternation by Agent ID/event ID and overflow placement when compatible furniture is full.

- [ ] **Step 2: Run and confirm failure**

Run: `npm test -- --run tests/interiorAssignment.test.ts`

Expected: FAIL because the assignment module does not exist.

- [ ] **Step 3: Expose a read-only Agent snapshot**

```ts
interiorSnapshot(): InteriorAgentSnapshot {
  return {
    agentId: this.agentId,
    role: this.role,
    buildingId: this.presenceState.kind === 'inside' ? this.presenceState.buildingId : undefined,
    action: this.currentRoute?.action ?? this.currentAssignment?.action ?? 'arrive',
    eventKind: this.currentEvent?.kind ?? 'unknown',
    eventId: this.currentEvent?.eventId ?? '',
  };
}
```

Return copied scalar state only; do not expose mutable controllers to the pure assignment function.

- [ ] **Step 4: Implement stable furniture selection**

Filter compatible furniture by action, sort by furniture ID, rotate `web`/`tool` choices from a stable Agent/event hash, reserve one point per occupant, then use deterministic overflow points. Return the furniture icon only for the assigned active station.

- [ ] **Step 5: Verify and commit**

Run: `npm test -- --run tests/interiorAssignment.test.ts`

Expected: PASS.

```bash
git add pixelworld_mvp/src/rendering/interiorAssignment.ts pixelworld_mvp/src/agents/AgentController.ts pixelworld_mvp/tests/interiorAssignment.test.ts
git commit -m "feat(pixelworld): assign interior Agent workstations"
```

### Task 6: Clickable live interior cutaway

**Files:**
- Create: `pixelworld_mvp/src/rendering/InteriorCutawaySystem.ts`
- Create: `pixelworld_mvp/tests/interiorCutawaySystem.test.ts`
- Modify: `pixelworld_mvp/src/scenes/WorldScene.ts`
- Modify: `pixelworld_mvp/tests/worldSceneCloneReservations.test.ts`
- Modify: `pixelworld_mvp/src/styles.css`

**Interfaces:**
- Consumes: `WorldDefinition`, `INTERIOR_DEFINITIONS`, `BuildingHitRegion[]`, `AgentController.interiorSnapshot()`, Agent textures, and interior textures.
- Produces: `open(buildingId)`, `close()`, `update(snapshots)`, `destroy()`, `isOpen()`, and `openBuildingId()`.

- [ ] **Step 1: Write failing overlay lifecycle tests**

```ts
cutaway.open('rest-cabin');
expect(cutaway.isOpen()).toBe(true);
expect(cutaway.openBuildingId()).toBe('rest-cabin');
cutaway.update([idleInsideRest]);
expect(renderedOccupants()).toEqual([{ agentId: 'main', furnitureId: 'rest-sofa' }]);
cutaway.close();
expect(cutaway.isOpen()).toBe(false);
```

Test idempotent repeated open/close, empty houses, Escape/backdrop close, live action change, unchanged camera scroll/zoom, and destroy cleanup.

- [ ] **Step 2: Run and confirm failure**

Run: `npm test -- --run tests/interiorCutawaySystem.test.ts tests/worldSceneCloneReservations.test.ts`

Expected: FAIL because the cutaway does not exist.

- [ ] **Step 3: Build the overlay shell and roof reveal**

Create a depth-`100_000` Phaser container with fixed-screen backdrop, centered panel, enlarged exterior shell, 180–240 ms roof y/alpha tween, interior floor/walls, title/count/status, close button, and pixel-perfect furniture. Use 2× or 3× integer scale only. Stop and replace outstanding tweens on repeated calls.

- [ ] **Step 4: Render live projected occupants and activity icons**

Call `assignInteriorOccupants`, create one image per inside Agent using its existing skin/facing frame, place it at the furniture anchor, and draw a compact pixel icon only over its active furniture. Idle uses a seated/low sprite offset at sofa/TV; offline uses bed; web alternates computer/bookcase; edit uses terminal; tool alternates workbench/tool wall; clone uses dispatch pod; respond uses radio desk.

- [ ] **Step 5: Wire building hit regions and lifecycle in WorldScene**

```ts
const cutaway = new InteriorCutawaySystem(this, this.worldDefinition);
village.hitRegions.forEach(({ buildingId, object }) => object.on('pointerdown', () => cutaway.open(buildingId)));
// update loop
cutaway.update(this.agents.all().map((agent) => agent.interiorSnapshot()));
```

Clone creation remains at `collaboration-barn.entrance.outside`; update the old hard-coded `signal-station` lookup. Close/destroy on shutdown and keep the world camera untouched.

- [ ] **Step 6: Verify and commit**

Run: `npm test -- --run tests/interiorCutawaySystem.test.ts tests/worldSceneCloneReservations.test.ts`

Expected: PASS.

Run: `npm run typecheck`

Expected: PASS.

```bash
git add pixelworld_mvp/src/rendering/InteriorCutawaySystem.ts pixelworld_mvp/src/scenes/WorldScene.ts pixelworld_mvp/src/styles.css pixelworld_mvp/tests
git commit -m "feat(pixelworld): add live house interior cutaways"
```

### Task 7: Full regression, browser acceptance, refinement, and graph refresh

**Files:**
- Modify: `pixelworld_mvp/tests/villageSystemAcceptance.test.ts`
- Modify: `pixelworld_mvp/public/assets/ASSET_SOURCES.md`
- Modify: `docs/superpowers/specs/2026-08-08-themed-village-interior-cutaway-design.md`

**Interfaces:**
- Consumes: all prior task deliverables.
- Produces: verified responsive application at `http://127.0.0.1:5173/` and a current `.codegraph` index without committing `.codegraph/`.

- [ ] **Step 1: Add end-to-end contract coverage**

```ts
expect(WORLD_DEFINITION.buildings).toHaveLength(4);
expect(new Set(WORLD_DEFINITION.buildings.map(({ themeId }) => themeId)).size).toBe(4);
expect(routeEvent(event('idle')).destinationId).toBe('rest-sofa');
expect(routeEvent(event('web')).destinationId).toBe('research-web');
expect(routeEvent(event('clone')).destinationId).toBe('dispatch-pod');
```

Cover bridge routing, four doors, occupancy state, clone emergence, and cutaway state preservation.

- [ ] **Step 2: Run all automated verification**

Run: `npm test && npm run typecheck && npm run build`

Expected: all Vitest files pass, TypeScript emits no errors, and Vite builds successfully.

Run from repository root: `pytest -q`

Expected: all root hook/parser tests pass.

- [ ] **Step 3: Browser-QA the fixed village at both target viewports**

At 1280×720 and 840×480 verify four visually separate houses, unique themes, winding river, two bridges, pasture/crops/trees, cow/sheep/chicken/pig motion, no console errors, and all asset requests HTTP 200.

- [ ] **Step 4: Exercise live hook states**

Use the Test Panel to send `idle`, `web`, `edit`, `tool`, and `clone`. Wait for actual door-constrained A* arrival, click the occupied house, and verify sofa/TV, computer/bookcase, terminal, workbench/tool wall, and dispatch-pod placement. Keep at least three Agents in different houses and confirm the fixed global view plus building occupancy badges.

- [ ] **Step 5: Exercise cutaway controls and responsiveness**

Open every house empty and occupied, close by button/Escape/backdrop, and confirm the same selected Agent, camera, presence, and roster remain. Capture final screenshots at both viewports and fix any overlap, clipped title/control, non-integer scaling, weak door, house-grouping, or foreground-depth issue before proceeding.

- [ ] **Step 6: Refresh and verify CodeGraph**

Run: `codegraph update`

Run: `codegraph explore "Trace a click on a village house through InteriorCutawaySystem and explain how Agent hook state selects furniture without changing Agent presence."`

Expected: current source and call path include `VillageRenderer`, `WorldScene`, `InteriorCutawaySystem`, `AgentController.interiorSnapshot`, and `assignInteriorOccupants`.

- [ ] **Step 7: Mark the approved spec implemented and commit**

Change spec status to `implemented and browser-verified`, record the verification date, then:

```bash
git add pixelworld_mvp docs/superpowers/specs/2026-08-08-themed-village-interior-cutaway-design.md
git commit -m "test(pixelworld): verify themed village interiors"
```
