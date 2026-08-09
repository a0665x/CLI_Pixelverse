# Interior Editor Grid and Catalog Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a deterministic half-cell furniture editor with rotation, all 339 purchased Modern Office assets, persistent layouts, and crisp DOM controls.

**Architecture:** Extract placement math and catalog data into focused modules so preview and commit share one immutable candidate. Keep pixel artwork and occupancy highlights in Phaser, while a new DOM cutaway overlay owns every textual control and publishes commands back to `InteriorCutawaySystem`.

**Tech Stack:** TypeScript 5, Phaser 3, DOM/CSS, Vitest, Bash, ImageMagick, Vite.

## Global Constraints

- Keep the authored room at 14×9 logical cells and use an 11-pixel half-cell editor grid.
- Green preview and mouse release must consume the same stored placement candidate.
- Extract all exactly 339 purchased singles into the ignored private asset directory; do not commit purchased PNGs.
- Rotation is limited to 0°, 90°, 180°, and 270°.
- Sizes remain exactly 75%, 100%, 125%, and 150%.
- Only explicit Save writes local storage; closing an unsaved session discards it.
- All cutaway title, status, button, pagination, and diagnostic text must render in HTML, not Phaser text.
- Maintain indoor four-direction A* motion and conservatively block navigation cells touched by fine-grid furniture.

---

## File map

- Create `pixelworld_mvp/src/rendering/interiorPlacement.ts`: fine-grid footprint, parity snapping, rotation, candidate resolution, and navigation-cell projection.
- Create `pixelworld_mvp/src/rendering/modernOfficeCatalog.ts`: 339-entry generated catalog and category/page helpers.
- Create `pixelworld_mvp/src/rendering/InteriorCutawayDomOverlay.ts`: crisp cutaway title, status, editor controls, and catalog pagination.
- Create `pixelworld_mvp/tests/interiorPlacement.test.ts`: pure placement and rotation contracts.
- Create `pixelworld_mvp/tests/modernOfficeCatalog.test.ts`: catalog completeness, uniqueness, paging, and metadata.
- Create `pixelworld_mvp/tests/interiorCutawayDomOverlay.test.ts`: DOM overlay behavior.
- Modify `pixelworld_mvp/scripts/install-modern-office-assets.sh`: extract all singles and generate metadata.
- Modify `pixelworld_mvp/src/world/types.ts`: catalog asset ID and four-way orientation persistence.
- Modify `pixelworld_mvp/src/rendering/interiorLayoutEditor.ts`: candidate commits and schema v3 migration.
- Modify `pixelworld_mvp/src/rendering/InteriorCutawaySystem.ts`: drag transaction, fine grid, asset rendering, and overlay integration.
- Modify `pixelworld_mvp/src/rendering/interiorMotion.ts`: fine-footprint navigation projection.
- Modify `pixelworld_mvp/src/rendering/assetManifest.ts`: preload all catalog textures.
- Modify `pixelworld_mvp/src/rendering/modernOfficeManifest.ts`: semantic defaults backed by catalog IDs.
- Modify `pixelworld_mvp/src/styles.css`: crisp cutaway DOM styling.
- Modify existing rendering, layout, motion, and manifest tests for integration coverage.

---

### Task 1: Fine-grid placement and rotation model

**Files:**
- Create: `pixelworld_mvp/src/rendering/interiorPlacement.ts`
- Create: `pixelworld_mvp/tests/interiorPlacement.test.ts`
- Modify: `pixelworld_mvp/src/world/types.ts`
- Modify: `pixelworld_mvp/src/rendering/interiorLayoutEditor.ts`

**Interfaces:**
- Produces: `FurnitureRotation = 0 | 90 | 180 | 270` and optional `rotation`, `assetId`, `footprint` fields on `FurnitureDefinition`.
- Produces: `resolvePlacementCandidate(room, layout, furniture, pointerPoint, ignoreId?)` returning `PlacementCandidate`.
- Produces: `fineFootprintCells(furniture)` and `navigationCells(furniture)`.
- Consumes: `normalizeFurnitureScale` and the existing placement diagnostics.

- [ ] **Step 1: Write failing parity, rotation, and candidate tests**

```ts
it('centers even footprints on half coordinates', () => {
  const result = snapFurnitureCenter({ x: 4.2, y: 3.8 }, { width: 2, height: 3 });
  expect(result).toEqual({ x: 4.5, y: 4 });
});

it('swaps footprint axes after a quarter turn', () => {
  expect(rotatedFootprint({ width: 4, height: 2 }, 90)).toEqual({ width: 2, height: 4 });
});

it('uses one immutable candidate for preview and commit', () => {
  const candidate = resolvePlacementCandidate(room, [], sofa, { x: 4.2, y: 3.8 });
  expect(candidate.diagnostic).toBe('valid');
  expect(commitPlacementCandidate(room, [], candidate)).toEqual([candidate.furniture]);
});
```

- [ ] **Step 2: Run the new test and verify RED**

Run: `npm test -- --run tests/interiorPlacement.test.ts`

Expected: FAIL because `snapFurnitureCenter`, `rotatedFootprint`, `resolvePlacementCandidate`, and `commitPlacementCandidate` do not exist.

- [ ] **Step 3: Implement the placement primitives**

```ts
export const EDITOR_CELL = 11;
export type PlacementCandidate = {
  furniture: FurnitureDefinition;
  diagnostic: PlacementDiagnostic;
  fineCells: GridPoint[];
};

export function snapAxis(value: number, size: number): number {
  return size % 2 === 0 ? Math.round(value - 0.5) + 0.5 : Math.round(value);
}

export function rotatedFootprint(size: Footprint, rotation: FurnitureRotation): Footprint {
  return rotation % 180 === 0 ? { ...size } : { width: size.height, height: size.width };
}
```

Use half-cell integer coordinates internally when enumerating fine cells, then project every touched 2×2 fine-cell block to a unique logical navigation cell.

- [ ] **Step 4: Replace recalculated move/add operations with candidate commits**

`commitPlacementCandidate` must reject non-`valid` candidates and otherwise clone the exact `candidate.furniture` without rounding its half coordinates.

- [ ] **Step 5: Run focused tests and verify GREEN**

Run: `npm test -- --run tests/interiorPlacement.test.ts tests/interiorLayoutEditor.test.ts tests/interiorMotion.test.ts`

Expected: all selected tests pass.

- [ ] **Step 6: Commit**

```bash
git add pixelworld_mvp/src/world/types.ts pixelworld_mvp/src/rendering/interiorPlacement.ts pixelworld_mvp/src/rendering/interiorLayoutEditor.ts pixelworld_mvp/tests/interiorPlacement.test.ts pixelworld_mvp/tests/interiorLayoutEditor.test.ts pixelworld_mvp/tests/interiorMotion.test.ts
git commit -m "fix: make interior placement deterministic"
```

### Task 2: Full Modern Office catalog and installer

**Files:**
- Create: `pixelworld_mvp/src/rendering/modernOfficeCatalog.ts`
- Create: `pixelworld_mvp/tests/modernOfficeCatalog.test.ts`
- Modify: `pixelworld_mvp/scripts/install-modern-office-assets.sh`
- Modify: `pixelworld_mvp/src/rendering/modernOfficeManifest.ts`
- Modify: `pixelworld_mvp/src/rendering/assetManifest.ts`
- Test: `pixelworld_mvp/tests/modernOfficeManifest.test.ts`
- Test: `pixelworld_mvp/tests/assetManifest.test.ts`

**Interfaces:**
- Produces: `ModernOfficeCatalogItem { id, key, path, category, label, opaqueBounds, footprint, visualOffset }`.
- Produces: `MODERN_OFFICE_CATALOG`, `catalogPage(category, page, pageSize = 24)`, and `catalogItem(id)`.
- Consumes: the purchased archive at `$HOME/Downloads/Modern_Office_Revamped_v1.2.zip` or an explicit first script argument.

- [ ] **Step 1: Write failing completeness and paging tests**

```ts
it('contains all 339 unique purchased singles', () => {
  expect(MODERN_OFFICE_CATALOG).toHaveLength(339);
  expect(new Set(MODERN_OFFICE_CATALOG.map(({ id }) => id)).size).toBe(339);
  expect(MODERN_OFFICE_CATALOG.every(({ footprint }) => footprint.width > 0 && footprint.height > 0)).toBe(true);
});

it('pages every item without duplicates', () => {
  const ids = catalogCategories().flatMap((category) => allCatalogPages(category).flatMap((page) => page.items.map(({ id }) => id)));
  expect(new Set(ids).size).toBe(339);
});
```

- [ ] **Step 2: Run catalog tests and verify RED**

Run: `npm test -- --run tests/modernOfficeCatalog.test.ts`

Expected: FAIL because the catalog module does not exist.

- [ ] **Step 3: Upgrade the installer**

Replace the 12-ID list with archive validation for IDs 1 through 339. Extract each `Modern_Office_Singles_<id>.png`, then invoke ImageMagick `convert <file> -alpha extract -trim -format '%@' info:` to derive opaque bounds. Generate a deterministic TypeScript array with numeric bounds, broad range category, inferred 11-pixel footprint, and visual-center offset. Abort when the archive count is not exactly 339 or ImageMagick is unavailable.

- [ ] **Step 4: Generate and load the catalog**

Run: `./scripts/install-modern-office-assets.sh "$HOME/Downloads/Modern_Office_Revamped_v1.2.zip"`

Expected: `Installed 339 licensed Modern Office singles` and generated `src/rendering/modernOfficeCatalog.ts`.

Update `preloadVillageAssets` to load all catalog image keys and keep semantic aliases resolving to their current IDs.

- [ ] **Step 5: Run manifest and catalog tests**

Run: `npm test -- --run tests/modernOfficeCatalog.test.ts tests/modernOfficeManifest.test.ts tests/assetManifest.test.ts tests/renderingContracts.test.ts`

Expected: all selected tests pass and report 339 unique catalog assets.

- [ ] **Step 6: Commit source metadata and installer, excluding private PNGs**

```bash
git add pixelworld_mvp/scripts/install-modern-office-assets.sh pixelworld_mvp/src/rendering/modernOfficeCatalog.ts pixelworld_mvp/src/rendering/modernOfficeManifest.ts pixelworld_mvp/src/rendering/assetManifest.ts pixelworld_mvp/tests/modernOfficeCatalog.test.ts pixelworld_mvp/tests/modernOfficeManifest.test.ts pixelworld_mvp/tests/assetManifest.test.ts pixelworld_mvp/tests/renderingContracts.test.ts
git commit -m "feat: expose complete Modern Office catalog"
```

### Task 3: Schema v3 persistence and migration

**Files:**
- Modify: `pixelworld_mvp/src/rendering/interiorLayoutEditor.ts`
- Modify: `pixelworld_mvp/tests/interiorLayoutEditor.test.ts`

**Interfaces:**
- Produces: `SavedInteriorLayoutV3 { version: 3; furniture: FurnitureDefinition[] }`.
- Consumes: `catalogItem`, `normalizeFurnitureScale`, and valid four-way rotations.

- [ ] **Step 1: Write failing migration and exact-restore tests**

```ts
it('persists half positions, asset IDs, and rotation in schema v3', () => {
  saveInteriorLayout('house', [{ ...sofa, point: { x: 4.5, y: 3 }, assetId: 200, rotation: 90 }], storage);
  expect(JSON.parse(storage.value)).toMatchObject({ version: 3, furniture: [{ point: { x: 4.5, y: 3 }, assetId: 200, rotation: 90 }] });
});

it('migrates v2 facing and semantic kind to rotation and catalog ID', () => {
  storage.value = JSON.stringify({ version: 2, furniture: [{ ...sofa, facing: 'right' }] });
  expect(loadInteriorLayout('house', room, storage)[0]).toMatchObject({ rotation: 90, assetId: 200 });
});
```

- [ ] **Step 2: Run and verify RED**

Run: `npm test -- --run tests/interiorLayoutEditor.test.ts`

Expected: FAIL because save still emits version 2 and migration lacks rotation/catalog metadata.

- [ ] **Step 3: Implement v3 normalization and migration**

Map `up/right/down/left` to `0/90/180/270`, validate catalog IDs with `catalogItem`, preserve half coordinates, and fall back to authored layout for corrupt or unsupported envelopes.

- [ ] **Step 4: Run and verify GREEN**

Run: `npm test -- --run tests/interiorLayoutEditor.test.ts`

Expected: all persistence tests pass.

- [ ] **Step 5: Commit**

```bash
git add pixelworld_mvp/src/rendering/interiorLayoutEditor.ts pixelworld_mvp/tests/interiorLayoutEditor.test.ts
git commit -m "feat: persist rotated catalog furniture"
```

### Task 4: Crisp cutaway DOM overlay

**Files:**
- Create: `pixelworld_mvp/src/rendering/InteriorCutawayDomOverlay.ts`
- Create: `pixelworld_mvp/tests/interiorCutawayDomOverlay.test.ts`
- Modify: `pixelworld_mvp/index.html`
- Modify: `pixelworld_mvp/src/styles.css`

**Interfaces:**
- Produces: `InteriorCutawayDomOverlay` with `open(model, handlers)`, `update(model)`, `setCatalog(model)`, and `close()`.
- Emits handlers for close, edit toggle, save, rotate left/right, resize down/up, category select, and page change.
- Consumes a canvas rectangle provider identical to `DomStatusOverlay`.

- [ ] **Step 1: Write failing DOM tests**

```ts
it('renders every cutaway string as crisp DOM text', () => {
  overlay.open(model, handlers);
  expect(root.querySelector('.cutaway-title')?.textContent).toBe('研究圖書館');
  expect(root.querySelectorAll('canvas')).toHaveLength(0);
  expect(root.querySelector('.cutaway-status')?.textContent).toContain('編輯模式');
});

it('emits catalog and rotation controls without pointer leakage', () => {
  root.querySelector<HTMLButtonElement>('[data-action="rotate-right"]')!.click();
  expect(handlers.rotateRight).toHaveBeenCalledOnce();
});
```

- [ ] **Step 2: Run and verify RED**

Run: `npm test -- --run tests/interiorCutawayDomOverlay.test.ts`

Expected: FAIL because `InteriorCutawayDomOverlay` does not exist.

- [ ] **Step 3: Build the semantic DOM component**

Create one root under `#cutaway-ui-layer`, use real `<button>` elements, `aria-live` status, `aria-label` catalog items, and `pointerdown` propagation guards. Position the panel from the canvas rectangle and the internal `CutawayLayout` scale.

- [ ] **Step 4: Add crisp CSS**

Use `Inter, "Noto Sans TC", system-ui, sans-serif`, `13px` title, `11px` controls/status, and `9px` contextual Hook labels. Do not use `image-rendering: pixelated` on the DOM layer.

- [ ] **Step 5: Run and verify GREEN**

Run: `npm test -- --run tests/interiorCutawayDomOverlay.test.ts tests/statusPresentation.test.ts`

Expected: all selected tests pass.

- [ ] **Step 6: Commit**

```bash
git add pixelworld_mvp/index.html pixelworld_mvp/src/styles.css pixelworld_mvp/src/rendering/InteriorCutawayDomOverlay.ts pixelworld_mvp/tests/interiorCutawayDomOverlay.test.ts
git commit -m "feat: render cutaway controls in crisp DOM"
```

### Task 5: Phaser drag transaction, fine grid, catalog drawer, and rotation

**Files:**
- Modify: `pixelworld_mvp/src/rendering/InteriorCutawaySystem.ts`
- Modify: `pixelworld_mvp/tests/interiorCutawaySystem.test.ts`

**Interfaces:**
- Consumes: `resolvePlacementCandidate`, `commitPlacementCandidate`, `MODERN_OFFICE_CATALOG`, and `InteriorCutawayDomOverlay`.
- Maintains: `currentDragCandidate?: PlacementCandidate` as the only preview/commit source.

- [ ] **Step 1: Write failing interaction tests**

```ts
it('commits the exact last green preview candidate', () => {
  paletteItem.emit('drag', pointer, validX, validY);
  const preview = capturePreviewCells();
  paletteItem.emit('dragend', pointer, invalidX, invalidY);
  expect(renderedFurnitureCells()).toEqual(preview);
});

it('renders the 11px edit grid and 24 catalog items per page', () => {
  enterEditMode();
  expect(gridLineSpacing()).toBe(11);
  expect(draggableCatalogItems()).toHaveLength(24);
});
```

- [ ] **Step 2: Run and verify RED**

Run: `npm test -- --run tests/interiorCutawaySystem.test.ts`

Expected: FAIL because drag end recalculates coordinates, the grid is 22 pixels, and only 14 semantic items exist.

- [ ] **Step 3: Replace drag handlers with one transaction**

On every drag event, compute and store `currentDragCandidate`, move the visible clone using catalog visual offsets, and draw its fine cells. On drag end, ignore event coordinates and commit `currentDragCandidate` exactly when it is valid. Clear the candidate after commit or revert.

- [ ] **Step 4: Render fine grid and catalog page**

Draw 11-pixel grid lines only in edit mode. Create Phaser catalog sprites from the DOM overlay's selected category/page model. Each palette sprite remains fixed while a separate drag clone follows the pointer.

- [ ] **Step 5: Integrate selection, rotation, sizing, and contextual labels**

Send double-click selection to the DOM overlay. Rotation and size handlers resolve a new candidate at the current point and commit only when valid. Remove Phaser title, status, button, inspector, and persistent Hook-label text objects.

- [ ] **Step 6: Run and verify GREEN**

Run: `npm test -- --run tests/interiorCutawaySystem.test.ts tests/interiorPlacement.test.ts tests/interiorLayoutEditor.test.ts`

Expected: all selected tests pass.

- [ ] **Step 7: Commit**

```bash
git add pixelworld_mvp/src/rendering/InteriorCutawaySystem.ts pixelworld_mvp/tests/interiorCutawaySystem.test.ts
git commit -m "feat: rebuild cutaway furniture interactions"
```

### Task 6: Indoor navigation coverage

**Files:**
- Modify: `pixelworld_mvp/src/rendering/interiorMotion.ts`
- Modify: `pixelworld_mvp/tests/interiorMotion.test.ts`

**Interfaces:**
- Consumes: `navigationCells(furniture)` from `interiorPlacement.ts`.
- Preserves: four-direction logical-cell A* paths.

- [ ] **Step 1: Write failing fine-coverage tests**

```ts
it('blocks every navigation cell touched by half-positioned rotated furniture', () => {
  const interior = roomWith({ ...desk, point: { x: 4.5, y: 4 }, rotation: 90 });
  const path = interiorPath(interior, { x: 2, y: 4 }, { x: 7, y: 4 });
  expect(path.some((point) => navigationCells(desk).some((cell) => samePoint(point, cell)))).toBe(false);
});
```

- [ ] **Step 2: Run and verify RED**

Run: `npm test -- --run tests/interiorMotion.test.ts`

Expected: FAIL because motion currently blocks coarse `furnitureCells` only.

- [ ] **Step 3: Use projected navigation cells throughout indoor routing**

Replace blocked-set construction and interaction clearance calculations with rotation-aware projected cells while keeping movement nodes integer and orthogonal.

- [ ] **Step 4: Run and verify GREEN**

Run: `npm test -- --run tests/interiorMotion.test.ts tests/agentBuildingTransit.test.ts`

Expected: all selected tests pass.

- [ ] **Step 5: Commit**

```bash
git add pixelworld_mvp/src/rendering/interiorMotion.ts pixelworld_mvp/tests/interiorMotion.test.ts
git commit -m "fix: route agents around fine-grid furniture"
```

### Task 7: Full verification and browser acceptance

**Files:**
- Modify if defects are found: files owned by Tasks 1–6 and their matching tests.

**Interfaces:**
- Verifies all public behavior from the approved design.

- [ ] **Step 1: Run full automated verification**

Run: `npm test -- --run && npm run build`

Expected: all Vitest files pass; TypeScript and Vite build exit 0.

Run from repository root: `PYTHONPATH=. pytest -q`

Expected: 51 Python tests pass.

- [ ] **Step 2: Run browser QA at 1280×720 and 1.5× game scale**

Verify each item manually in `http://127.0.0.1:5173/`:

1. placed furniture and catalog clones follow the pointer;
2. a green preview always remains after release;
3. red bounds, door, and overlap previews revert with the matching reason;
4. even footprints are visually centered;
5. rotation swaps occupied width/height;
6. all five categories and every page are reachable, totaling 339 items;
7. Save followed by reload restores position, size, rotation, and asset;
8. title, controls, status, pagination, and diagnostics are crisp DOM text;
9. Agents continue to use orthogonal indoor paths around edited furniture.

- [ ] **Step 3: Check browser console and network**

Expected: no application errors and no missing Modern Office asset requests. Headless WebGL readback performance warnings are informational only.

- [ ] **Step 4: Synchronize CodeGraph**

Run: `codegraph sync . && codegraph status .`

Expected: `Index is up to date`.

- [ ] **Step 5: Final commit if QA required corrections**

```bash
git add pixelworld_mvp
git commit -m "fix: close interior editor QA gaps"
```
