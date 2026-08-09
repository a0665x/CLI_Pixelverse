# Layered Interior Prefab Editor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a quarter-grid layered room composer with overlap, marquee prefabs, room inventory controls, required Hook furniture, cross-house decorative copy/paste, more farm animals, and believable river bridges.

**Architecture:** Keep placement, selection, prefab, inventory, and clipboard behavior in pure model modules, then make `InteriorCutawaySystem` a Phaser interaction adapter and `InteriorCutawayDomOverlay` the crisp control surface. Persist room layouts as v4 and global prefab/clipboard envelopes separately. Preserve the 14×9 navigation room and project only blocking furniture onto the existing A* grid.

**Tech Stack:** TypeScript 5, Phaser 3, DOM/CSS overlay, Vitest, Vite, localStorage, CodeGraph.

## Global Constraints

- Use only the installed licensed Modern Office v1.2 assets for interior furniture.
- Keep all visible UI text in the high-resolution DOM overlay.
- Keep room bounds and authored door positions fixed at 14×9 logical cells.
- Use explicit save for per-room drafts; prefabs and the global clipboard save immediately.
- Never duplicate Hook actions through prefabs or cross-room copy.
- Do not add a game-engine dependency or change the fixed village camera.
- Implement each production behavior only after its failing Vitest test is observed.

---

## File Structure

- `src/world/types.ts`: persisted furniture layer, blocking, Hook requirement, prefab, and clipboard types.
- `src/rendering/interiorPlacement.ts`: quarter-grid snapping, room/door validation, visual overlap, and navigation projection.
- `src/rendering/interiorSelection.ts`: alpha-bound marquee intersection, multi-selection transforms, and prefab construction.
- `src/rendering/interiorPrefabStore.ts`: prefab and clipboard serialization, migration validation, placement, and atomic paste.
- `src/rendering/interiorLayoutEditor.ts`: v4 room persistence, required Hook inventory, collect-all, layering, and z-order operations.
- `src/rendering/InteriorCutawayDomOverlay.ts`: inventory, prefab, clipboard, layer, selection, and completeness controls.
- `src/rendering/InteriorCutawaySystem.ts`: Phaser marquee and drag interaction, layered rendering, palette/prefab drops, and overlay wiring.
- `src/rendering/punyVillageAtlas.ts`: curated timber bridge regions.
- `src/rendering/VillageRenderer.ts`: bridge command generation.
- `src/world/worldDefinition.ts`: expanded farm animal declarations.
- Existing focused test files plus new selection/store tests prove each model boundary.

---

### Task 1: Quarter-grid overlap and layer-aware navigation

**Files:**
- Modify: `pixelworld_mvp/src/world/types.ts`
- Modify: `pixelworld_mvp/src/rendering/interiorPlacement.ts`
- Modify: `pixelworld_mvp/src/rendering/interiorLayoutEditor.ts`
- Test: `pixelworld_mvp/tests/interiorPlacement.test.ts`
- Test: `pixelworld_mvp/tests/interiorLayoutEditor.test.ts`

**Interfaces:**
- Produces `FurnitureLayer = 'floor' | 'furniture' | 'surface' | 'wall'`.
- Produces `snapFurniturePoint(point, footprint): GridPoint` on 0.25 increments.
- Produces `transformedAlphaBounds(item, catalogItem): PixelRect` from exact non-transparent pixels.
- Produces `defaultFurnitureLayer(item): FurnitureLayer` and `furnitureBlocksNavigation(item): boolean`.
- Changes `diagnoseFinePlacement` so overlap is legal but room and door violations remain illegal.

- [ ] **Step 1: Write failing placement tests**

```ts
it('snaps to quarter cells and permits overlapping visual furniture', () => {
  expect(snapFurniturePoint({ x: 2.38, y: 3.62 }, { width: 1, height: 1 })).toEqual({ x: 2.5, y: 3.5 });
  expect(placementDiagnostic(room, { ...chair, point: desk.point }, [desk])).toBe('valid');
});

it('projects only blocking layers into navigation', () => {
  expect(navigationCells({ ...rug, layer: 'floor', blocksNavigation: false })).toEqual([]);
  expect(navigationCells({ ...desk, layer: 'furniture', blocksNavigation: true }).length).toBeGreaterThan(0);
});

it('uses the transformed minimum alpha rectangle without tile inflation', () => {
  expect(transformedAlphaBounds(thinLamp, catalogItem(98)!)).toEqual({
    x: expect.any(Number), y: expect.any(Number),
    width: catalogItem(98)!.opaqueBounds.width * thinLamp.scale,
    height: catalogItem(98)!.opaqueBounds.height * thinLamp.scale,
  });
});
```

- [ ] **Step 2: Run the focused tests and observe RED**

Run: `npm test -- --run tests/interiorPlacement.test.ts tests/interiorLayoutEditor.test.ts`

Expected: FAIL because quarter snapping/layer properties do not exist and overlap still reports `overlap`.

- [ ] **Step 3: Implement the minimal quarter-grid and layer model**

Set `EDITOR_CELL = 5.5`, snap stored logical points to `Math.round(value * 4) / 4`, and compute exact transformed alpha bounds from catalog `opaqueBounds`, corrected origin, scale, and rotation. Remove furniture-overlap rejection, apply room/door checks to the exact rectangle, and return no navigation cells when `blocksNavigation` is false. Project blocking rectangles onto logical navigation cells only at the final navigation boundary. Assign semantic defaults from catalog category and authored furniture kind.

- [ ] **Step 4: Run focused and dependent tests**

Run: `npm test -- --run tests/interiorPlacement.test.ts tests/interiorLayoutEditor.test.ts tests/interiorMotion.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add pixelworld_mvp/src/world/types.ts pixelworld_mvp/src/rendering/interiorPlacement.ts pixelworld_mvp/src/rendering/interiorLayoutEditor.ts pixelworld_mvp/tests/interiorPlacement.test.ts pixelworld_mvp/tests/interiorLayoutEditor.test.ts
git commit -m "feat: add layered quarter-grid placement"
```

### Task 2: Marquee selection and reusable prefab model

**Files:**
- Create: `pixelworld_mvp/src/rendering/interiorSelection.ts`
- Create: `pixelworld_mvp/tests/interiorSelection.test.ts`
- Modify: `pixelworld_mvp/src/world/types.ts`

**Interfaces:**
- Produces `SelectionRect`, `selectedFurnitureIds(rect, layout, catalog)`, `moveSelection(...)`, and `createFurniturePrefab(name, selected)`.
- Produces `FurniturePrefab { id; name; createdAt; width; height; items }` with relative quarter-cell positions.

- [ ] **Step 1: Write failing selection and prefab tests**

```ts
it('selects every visible alpha bound intersecting the marquee', () => {
  expect(selectedFurnitureIds(rect, [desk, monitor, outside], catalog)).toEqual([desk.id, monitor.id]);
});

it('creates a relative prefab without Hook identity', () => {
  const prefab = createFurniturePrefab('工作桌組', [hookDesk, monitor]);
  expect(prefab.items).toHaveLength(2);
  expect(prefab.items[0]).not.toHaveProperty('supportedActions');
  expect(Math.min(...prefab.items.map(({ point }) => point.x))).toBe(0);
});
```

- [ ] **Step 2: Run and observe RED**

Run: `npm test -- --run tests/interiorSelection.test.ts`

Expected: FAIL because the module does not exist.

- [ ] **Step 3: Implement visual-bound selection and prefab normalization**

Reuse `transformedAlphaBounds` so marquee, selection outline, and prefab group bounds match the same minimum visible-pixel rectangle used by placement. Deep clone selected templates, normalize positions relative to the selection top-left, remove Hook requirement/action identity, and reject fewer than two ordinary items.

- [ ] **Step 4: Run focused tests**

Run: `npm test -- --run tests/interiorSelection.test.ts tests/modernOfficeCatalog.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add pixelworld_mvp/src/rendering/interiorSelection.ts pixelworld_mvp/src/world/types.ts pixelworld_mvp/tests/interiorSelection.test.ts
git commit -m "feat: add marquee furniture prefabs"
```

### Task 3: Prefab persistence and atomic room clipboard

**Files:**
- Create: `pixelworld_mvp/src/rendering/interiorPrefabStore.ts`
- Create: `pixelworld_mvp/tests/interiorPrefabStore.test.ts`
- Modify: `pixelworld_mvp/src/world/types.ts`

**Interfaces:**
- Produces `loadPrefabs`, `savePrefabs`, `upsertPrefab`, `deletePrefab`.
- Produces `copyDecorativeLayout`, `loadLayoutClipboard`, `pasteDecorativeLayout`.
- Uses `pixelworld:interior-prefabs:v1` and `pixelworld:interior-clipboard:v1`.

- [ ] **Step 1: Write failing persistence and paste tests**

```ts
it('persists prefabs independently from room layouts', () => {
  savePrefabs([prefab], storage);
  expect(loadPrefabs(storage)).toEqual([prefab]);
});

it('copies no Hook furniture and pastes atomically with fresh ids', () => {
  const clipboard = copyDecorativeLayout([hookDesk, rug, monitor]);
  expect(clipboard.items).toHaveLength(2);
  const result = pasteDecorativeLayout(room, [targetHook], clipboard);
  expect(result.accepted).toBe(true);
  expect(result.layout).toEqual(expect.arrayContaining([targetHook]));
});
```

- [ ] **Step 2: Run and observe RED**

Run: `npm test -- --run tests/interiorPrefabStore.test.ts`

Expected: FAIL because store functions do not exist.

- [ ] **Step 3: Implement validated stores and atomic paste**

Validate envelope versions, finite quarter-cell positions, catalog IDs, layer/z-order, and duplicate IDs. Generate new IDs at placement. Validate the entire transformed clipboard against room/door bounds before returning any changed layout.

- [ ] **Step 4: Run focused tests**

Run: `npm test -- --run tests/interiorPrefabStore.test.ts tests/interiorPlacement.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add pixelworld_mvp/src/rendering/interiorPrefabStore.ts pixelworld_mvp/src/world/types.ts pixelworld_mvp/tests/interiorPrefabStore.test.ts
git commit -m "feat: persist prefabs and room clipboard"
```

### Task 4: Required Hook inventory, collect-all, z-order, and v4 migration

**Files:**
- Modify: `pixelworld_mvp/src/rendering/interiorLayoutEditor.ts`
- Modify: `pixelworld_mvp/src/world/types.ts`
- Test: `pixelworld_mvp/tests/interiorLayoutEditor.test.ts`

**Interfaces:**
- Produces `requiredHookInventory(room, layout)`, `collectAllFurniture(layout)`, `revertInteriorDraft(buildingId, room, storage)`, `setFurnitureLayer`, `shiftFurnitureLayer`, and `reorderFurniture`.
- Saves `SavedInteriorLayoutV4` and migrates v2/v3.

- [ ] **Step 1: Write failing inventory and migration tests**

```ts
it('keeps required Hook entries unique and reports missing items after collection', () => {
  expect(requiredHookInventory(room, room.furniture).every(({ placed }) => placed)).toBe(true);
  expect(requiredHookInventory(room, collectAllFurniture(room.furniture)).every(({ placed }) => !placed)).toBe(true);
});

it('migrates v3 furniture to layered v4', () => {
  memory.set(key, JSON.stringify({ version: 3, furniture: oldLayout }));
  expect(loadInteriorLayout(id, room, storage)[0]).toMatchObject({ layer: expect.any(String), zIndex: expect.any(Number) });
});

it('reverts every unsaved draft operation to the last saved layout', () => {
  saveInteriorLayout(id, saved, storage);
  expect(revertInteriorDraft(id, room, storage)).toEqual(loadInteriorLayout(id, room, storage));
});
```

- [ ] **Step 2: Run and observe RED**

Run: `npm test -- --run tests/interiorLayoutEditor.test.ts`

Expected: FAIL on missing inventory operations and version 4.

- [ ] **Step 3: Implement required inventory and v4 operations**

Derive stable requirements from authored `supportedActions`, keep requirement instances unique, collect only the draft, normalize z-order within layers, provide adjacent-layer movement in the fixed layer order, reload the persisted layout for cancel/revert, and migrate old layouts using semantic defaults.

- [ ] **Step 4: Run focused tests**

Run: `npm test -- --run tests/interiorLayoutEditor.test.ts tests/interiorAssignment.test.ts tests/interiorMotion.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add pixelworld_mvp/src/rendering/interiorLayoutEditor.ts pixelworld_mvp/src/world/types.ts pixelworld_mvp/tests/interiorLayoutEditor.test.ts
git commit -m "feat: add Hook inventory and v4 layouts"
```

### Task 5: Crisp DOM controls for selection, inventory, prefab, and clipboard

**Files:**
- Modify: `pixelworld_mvp/src/rendering/InteriorCutawayDomOverlay.ts`
- Modify: `pixelworld_mvp/src/styles.css`
- Create: `pixelworld_mvp/tests/interiorCutawayDomOverlay.test.ts`

**Interfaces:**
- Extends `CutawayDomModel` with Hook completeness, clipboard availability, selection count, selected layer, and prefab-name prompt state.
- Extends handlers with `collectAll`, `revertDraft`, `copyLayout`, `pasteLayout`, `createPrefab`, `setLayer`, `shiftLayer`, and `reorder`.

- [ ] **Step 1: Write failing DOM-model tests**

Test a pure exported `cutawayControlState(model)` helper so Node tests verify control visibility without a browser DOM:

```ts
expect(cutawayControlState({ selectionCount: 2, clipboardAvailable: true, hookPlaced: 3, hookTotal: 5 }))
  .toMatchObject({ canCreatePrefab: true, canPaste: true, hookLabel: '必備 3/5' });
```

- [ ] **Step 2: Run and observe RED**

Run: `npm test -- --run tests/interiorCutawayDomOverlay.test.ts`

Expected: FAIL because the control helper and handlers are absent.

- [ ] **Step 3: Implement DOM controls and CSS**

Add the fixed left `本屋必備` strip, `組裝件` tab, collect/revert/copy/paste buttons, selection toolbar, same-layer z controls, previous/next layer controls, missing/placed badges, confirmation state, and accessible prefab-name input. Keep 9–13px CSS text and pointer events scoped to controls.

- [ ] **Step 4: Run focused tests and build**

Run: `npm test -- --run tests/interiorCutawayDomOverlay.test.ts tests/interiorCutawaySystem.test.ts && npm run build`

Expected: PASS and build exit 0.

- [ ] **Step 5: Commit**

```bash
git add pixelworld_mvp/src/rendering/InteriorCutawayDomOverlay.ts pixelworld_mvp/src/styles.css pixelworld_mvp/tests/interiorCutawayDomOverlay.test.ts
git commit -m "feat: add room composer controls"
```

### Task 6: Phaser marquee, layered rendering, prefab palette, and cross-house flow

**Files:**
- Modify: `pixelworld_mvp/src/rendering/InteriorCutawaySystem.ts`
- Modify: `pixelworld_mvp/tests/interiorCutawaySystem.test.ts`
- Modify: `pixelworld_mvp/src/scenes/WorldScene.ts` only if a cutaway-close callback is required for clipboard copy.

**Interfaces:**
- Consumes all model APIs from Tasks 1–5.
- Produces real pointer marquee selection, group dragging, prefab drops, required-item drops, collect/copy/paste actions, and render depth from layer/z-order.

- [ ] **Step 1: Write failing integration contract tests**

```ts
it('orders required Hooks before prefabs and catalog pages in edit mode', () => { /* assert rendered/control model ordering */ });
it('renders furniture by layer and zIndex while allowing identical bounds', () => { /* assert sprite depths */ });
it('copies layout and closes the cutaway before another house paste', () => { /* assert clipboard and isOpen */ });
```

- [ ] **Step 2: Run and observe RED**

Run: `npm test -- --run tests/interiorCutawaySystem.test.ts`

Expected: FAIL because the cutaway lacks the new interactions.

- [ ] **Step 3: Implement interaction wiring**

Create a marquee graphic only when pointer-down begins on empty room space. Maintain selected IDs, selection bounds, group preview, and immutable drop candidates. Render sprite depth as layer base plus z-index and Y tie-breaker. Render required Hook sources as unique inventory items, prefabs as multi-sprite preview containers, and clipboard actions through the DOM callbacks.

- [ ] **Step 4: Run cutaway/model tests and build**

Run: `npm test -- --run tests/interiorCutawaySystem.test.ts tests/interiorSelection.test.ts tests/interiorPrefabStore.test.ts tests/interiorLayoutEditor.test.ts && npm run build`

Expected: PASS and build exit 0.

- [ ] **Step 5: Commit**

```bash
git add pixelworld_mvp/src/rendering/InteriorCutawaySystem.ts pixelworld_mvp/src/scenes/WorldScene.ts pixelworld_mvp/tests/interiorCutawaySystem.test.ts
git commit -m "feat: integrate layered room composer"
```

### Task 7: Proper timber bridges

**Files:**
- Modify: `pixelworld_mvp/src/rendering/punyVillageAtlas.ts`
- Modify: `pixelworld_mvp/src/rendering/VillageRenderer.ts`
- Test: `pixelworld_mvp/tests/villageRenderer.test.ts`

**Interfaces:**
- Produces bridge deck/edge `PunyRegionName` entries.
- Changes bridge commands to use only bridge regions while keeping `sceneryRole: 'bridge'`.

- [ ] **Step 1: Write failing renderer test**

```ts
it('renders every declared crossing with bridge components rather than building walls', () => {
  const bridges = buildVillageRenderPlan(WORLD_DEFINITION).commands.filter(({ sceneryRole }) => sceneryRole === 'bridge');
  expect(bridges.length).toBeGreaterThan(0);
  expect(bridges.every(({ region }) => region.startsWith('bridge'))).toBe(true);
  expect(bridges.some(({ region }) => /Wall|Roof|Door/.test(region))).toBe(false);
});
```

- [ ] **Step 2: Run and observe RED**

Run: `npm test -- --run tests/villageRenderer.test.ts`

Expected: FAIL because crossings use `brownWall`.

- [ ] **Step 3: Curate bridge tiles and render directional crossings**

Add source-aligned timber bridge deck and rail regions from the installed compatible atlas. Choose start/middle/end frames from bridge width/height and render after water at bridge depth.

- [ ] **Step 4: Run village tests**

Run: `npm test -- --run tests/villageRenderer.test.ts tests/villageRoutes.test.ts tests/villageSystemAcceptance.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add pixelworld_mvp/src/rendering/punyVillageAtlas.ts pixelworld_mvp/src/rendering/VillageRenderer.ts pixelworld_mvp/tests/villageRenderer.test.ts
git commit -m "fix: render timber river bridges"
```

### Task 8: Expand and stagger farm animals

**Files:**
- Modify: `pixelworld_mvp/src/world/worldDefinition.ts`
- Modify: `pixelworld_mvp/src/rendering/AmbientAnimalSystem.ts`
- Test: `pixelworld_mvp/tests/ambientAnimalSystem.test.ts`
- Test: `pixelworld_mvp/tests/villageSystemAcceptance.test.ts`

**Interfaces:**
- Keeps `AmbientAnimalDefinition` and bounded patrol API.
- Adds ten farm definitions with species mix 2 cows, 3 sheep, 2 pigs, 3 chickens.

- [ ] **Step 1: Write failing animal population tests**

```ts
it('contains the approved ten-animal farm mix', () => {
  const counts = Object.groupBy(WORLD_DEFINITION.animals, ({ species }) => species);
  expect(Object.fromEntries(Object.entries(counts).map(([key, value]) => [key, value?.length]))).toEqual({ cow: 2, sheep: 3, pig: 2, chicken: 3 });
});
```

Also assert every start/target stays in pasture bounds and adjacent animals have different start X, lane Y, or pause phase.

- [ ] **Step 2: Run and observe RED**

Run: `npm test -- --run tests/ambientAnimalSystem.test.ts tests/villageSystemAcceptance.test.ts`

Expected: FAIL on current animal count/mix.

- [ ] **Step 3: Add staggered animal definitions**

Place ten animals across declared pastures with separate lane bounds and deterministic IDs. Preserve direction-specific flip behavior and Y-depth.

- [ ] **Step 4: Run focused tests**

Run: `npm test -- --run tests/ambientAnimalSystem.test.ts tests/villageSystemAcceptance.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add pixelworld_mvp/src/world/worldDefinition.ts pixelworld_mvp/src/rendering/AmbientAnimalSystem.ts pixelworld_mvp/tests/ambientAnimalSystem.test.ts pixelworld_mvp/tests/villageSystemAcceptance.test.ts
git commit -m "feat: enrich village farm animals"
```

### Task 9: Full verification, browser QA, and CodeGraph sync

**Files:**
- Modify tests or implementation only for failures found during this task.

**Interfaces:**
- Verifies the complete approved design through automated and live evidence.

- [ ] **Step 1: Run the complete automated suite**

Run: `npm test -- --run`

Expected: all test files and tests PASS with zero failures.

- [ ] **Step 2: Run production build and static checks**

Run: `npm run build && git diff --check`

Expected: build exit 0 and no whitespace errors. The existing chunk-size advisory is non-blocking.

- [ ] **Step 3: Browser-test the complete workflow at `http://127.0.0.1:5173/`**

Verify and capture screenshots for:

- rug under desk plus monitor on desk;
- quarter-grid movement, exact minimum alpha occupancy previews, and persistent diagnostics;
- marquee selection and saved prefab after reload;
- collect-all with prefabs retained and Hook items marked missing;
- cancel/revert after move, layer change, and collect-all;
- copy room, return to village, open another house, paste, and complete missing Hooks;
- save/reload persistence;
- ten correctly facing farm animals;
- timber bridge deck spanning river water;
- no console errors or failed asset requests.

- [ ] **Step 4: Sync and verify CodeGraph**

Run: `codegraph sync . && codegraph status . && codegraph explore "layered furniture prefab required Hook clipboard bridge animals"`

Expected: index is up to date and new symbols/call paths are present.

- [ ] **Step 5: Commit final QA fixes if any**

```bash
git add pixelworld_mvp
git commit -m "test: verify layered room composer"
```

Skip the commit only when verification produces no file changes.
