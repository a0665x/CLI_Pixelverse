# Precision Multi-Select Furniture Editor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Align furniture sprites with alpha occupancy, fit near-edge drops flush to walls, and provide mouse marquee batch editing including duplicate, grouping, return-to-shelf, layers, ordering, rotation, and scaling through 300%.

**Architecture:** `interiorPlacement.ts` owns the canonical resolved asset, opaque origin, edge fitting, and atomic transform validation. `interiorSelection.ts` owns selection-set mutations and duplication. `InteriorCutawaySystem.ts` translates Phaser input into those pure operations, while `InteriorCutawayDomOverlay.ts` renders the contextual controls.

**Tech Stack:** TypeScript, Phaser 3, DOM overlay, Vitest, localStorage v4 compatibility.

## Global Constraints

- Rendering, placement, preview, selection, and navigation must use one resolved Modern Office alpha rectangle.
- Ordinary motion uses quarter-grid snapping; exact wall fitting may produce off-grid finite anchors.
- Door obstruction rejects the entire operation.
- Batch operations are atomic.
- Scale values are exactly 75% through 300% in 25% increments.
- Duplicated Hooks become ordinary visual furniture without Hook identity or actions.
- Existing layout versions v2, v3, and v4 remain readable.

---

### Task 1: Canonical asset origin and wall fitting

**Files:**
- Modify: `pixelworld_mvp/src/rendering/interiorPlacement.ts`
- Modify: `pixelworld_mvp/src/rendering/InteriorCutawaySystem.ts`
- Test: `pixelworld_mvp/tests/interiorPlacement.test.ts`

**Interfaces:**
- Produces: `resolvedFurnitureAsset(item): ModernOfficeCatalogItem | undefined`
- Produces: `fitFurniturePointToRoom(room, item, point): GridPoint`
- Updates: `resolvePlacementCandidate` to snap, fit, then validate.

- [ ] **Step 1: Write failing tests for implicit and explicit catalog parity and edge fitting**

```ts
expect(resolvedFurnitureAsset({ kind: 'sofa' })?.id).toBe(200);
expect(transformedAlphaBounds(implicit)).toEqual(transformedAlphaBounds({ ...implicit, assetId: 200 }));
const fitted = resolvePlacementCandidate(room, [], sofa, { x: -0.25, y: 2 });
expect(fitted.diagnostic).toBe('valid');
expect(fitted.bounds.x).toBeCloseTo(0);
```

- [ ] **Step 2: Run the focused test and verify RED**

Run: `npm test -- --run tests/interiorPlacement.test.ts`
Expected: FAIL because the resolver is private and an edge crossing returns `outside-room`.

- [ ] **Step 3: Export the canonical resolver and add exact overflow correction**

```ts
export const resolvedFurnitureAsset = (item) =>
  catalogItem(item.assetId ?? DEFAULT_ASSET_ID[item.kind] ?? -1);

export function fitFurniturePointToRoom(room, furniture, point) {
  const candidate = { ...furniture, point };
  const bounds = transformedAlphaBounds(candidate);
  return {
    x: point.x + Math.max(0, -bounds.x) - Math.max(0, bounds.x + bounds.width - room.width),
    y: point.y + Math.max(0, -bounds.y) - Math.max(0, bounds.y + bounds.height - room.height),
  };
}
```

Use `resolvedFurnitureAsset` for both renderer texture origin and alpha bounds. Resolve candidates with `fitFurniturePointToRoom(room, furniture, snapFurniturePoint(pointerPoint))`.

- [ ] **Step 4: Run focused tests and build**

Run: `npm test -- --run tests/interiorPlacement.test.ts && npm run build`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add pixelworld_mvp/src/rendering/interiorPlacement.ts pixelworld_mvp/src/rendering/InteriorCutawaySystem.ts pixelworld_mvp/tests/interiorPlacement.test.ts
git commit -m "fix: unify furniture alpha origins and edge fitting"
```

### Task 2: Expanded scales and exact persistence

**Files:**
- Modify: `pixelworld_mvp/src/world/types.ts`
- Modify: `pixelworld_mvp/src/rendering/interiorPlacement.ts`
- Modify: `pixelworld_mvp/src/rendering/interiorLayoutEditor.ts`
- Test: `pixelworld_mvp/tests/interiorLayoutEditor.test.ts`

**Interfaces:**
- Produces: `FURNITURE_SCALES = [0.75, 1, 1.25, 1.5, 1.75, 2, 2.25, 2.5, 2.75, 3]`.
- Updates `normalizeFurnitureScale` and placement scale normalization.
- Preserves finite loaded/saved points without unconditional snapping.

- [ ] **Step 1: Write failing scale and edge-anchor persistence tests**

```ts
expect(FURNITURE_SCALES.at(-1)).toBe(3);
expect(resizeFurniture(room, [item], item.id, 3)[0]?.scale).toBe(3);
saveInteriorLayout('edge', [{ ...item, point: { x: 0.113636, y: 2 } }], storage);
expect(loadInteriorLayout('edge', room, storage)[0]?.point.x).toBeCloseTo(0.113636);
```

- [ ] **Step 2: Run and verify RED**

Run: `npm test -- --run tests/interiorLayoutEditor.test.ts`
Expected: FAIL because `3` is not a valid scale and save/load snaps the anchor.

- [ ] **Step 3: Expand the scale union and stop normalizing finite persisted points to the grid**

```ts
export type FurnitureScale = 0.75 | 1 | 1.25 | 1.5 | 1.75 | 2 | 2.25 | 2.5 | 2.75 | 3;
```

Normalize only scales against `FURNITURE_SCALES`. Clone finite points unchanged during save/load; snapping occurs only in interactive placement.

- [ ] **Step 4: Run focused tests and build**

Run: `npm test -- --run tests/interiorLayoutEditor.test.ts tests/interiorPlacement.test.ts && npm run build`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add pixelworld_mvp/src/world/types.ts pixelworld_mvp/src/rendering/interiorPlacement.ts pixelworld_mvp/src/rendering/interiorLayoutEditor.ts pixelworld_mvp/tests/interiorLayoutEditor.test.ts
git commit -m "feat: support precise anchors and three-times furniture scale"
```

### Task 3: Pure multi-selection mutations and duplication

**Files:**
- Modify: `pixelworld_mvp/src/rendering/interiorSelection.ts`
- Test: `pixelworld_mvp/tests/interiorSelection.test.ts`

**Interfaces:**
- Produces: `removeSelection(layout, ids): FurnitureDefinition[]`
- Produces: `transformSelectionAtomically(room, layout, ids, transform): LayoutMutationResult`
- Produces: `duplicateFurniture(room, layout, id, now): { accepted; layout; selectedIds }`

- [ ] **Step 1: Write failing tests for return, atomic transforms, and Hook-safe duplicate**

```ts
expect(removeSelection(layout, ['a', 'b']).map(({ id }) => id)).toEqual(['c']);
expect(transformSelectionAtomically(room, layout, ['a', 'b'], item => ({ ...item, layer: 'surface' })).accepted).toBe(true);
const duplicated = duplicateFurniture(room, [hook], hook.id, 10);
expect(duplicated.layout[1]).toMatchObject({ supportedActions: [], icon: 'generic' });
expect(duplicated.layout[1]).not.toHaveProperty('requirementId');
```

- [ ] **Step 2: Run and verify RED**

Run: `npm test -- --run tests/interiorSelection.test.ts`
Expected: FAIL because the mutation APIs do not exist.

- [ ] **Step 3: Implement immutable atomic mutations and nearest legal duplicate search**

Search quarter-grid offsets in increasing Manhattan distance, prefer `{x: .25, y: .25}`, strip Hook identity from the clone, and return original plus clone IDs on success. Validate the complete transformed selection before returning it.

- [ ] **Step 4: Run focused tests**

Run: `npm test -- --run tests/interiorSelection.test.ts tests/interiorPrefabStore.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add pixelworld_mvp/src/rendering/interiorSelection.ts pixelworld_mvp/tests/interiorSelection.test.ts
git commit -m "feat: add atomic furniture selection mutations"
```

### Task 4: Mouse marquee and contextual operation toolbar

**Files:**
- Modify: `pixelworld_mvp/src/rendering/InteriorCutawayDomOverlay.ts`
- Modify: `pixelworld_mvp/src/rendering/InteriorCutawaySystem.ts`
- Modify: `pixelworld_mvp/src/styles.css`
- Test: `pixelworld_mvp/tests/interiorCutawaySystem.test.ts`

**Interfaces:**
- Overlay handler additions: `duplicate`, `returnToShelf`, `cancelSelection`.
- Model additions: `canGroup`, `canDuplicate`, selected item count.
- Phaser background marquee starts without Shift and ignores direct furniture hits.

- [ ] **Step 1: Write failing tests for contextual capabilities**

```ts
expect(selectionCapabilities([ordinary])).toMatchObject({ canDuplicate: true, canGroup: false });
expect(selectionCapabilities([ordinary, second])).toMatchObject({ canDuplicate: false, canGroup: true });
```

- [ ] **Step 2: Run and verify RED**

Run: `npm test -- --run tests/interiorCutawaySystem.test.ts`
Expected: FAIL because contextual capability and new handlers do not exist.

- [ ] **Step 3: Add the DOM buttons and connect batch operations**

Render buttons for cancel, duplicate, group, return, layer, order, rotate, and scale. Apply layer/order/rotation/scale to every selected ID using the atomic mutation API. Keep controls high-resolution DOM text.

- [ ] **Step 4: Replace Shift-only selection with background drag selection**

Track interactive furniture sprites in a `Set`. In global pointer-down, inspect hit objects and begin marquee only when no hit object belongs to that set. Pointer-up selects exact alpha intersections; an empty click clears the selection.

- [ ] **Step 5: Run focused tests and build**

Run: `npm test -- --run tests/interiorCutawaySystem.test.ts tests/interiorSelection.test.ts && npm run build`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add pixelworld_mvp/src/rendering/InteriorCutawayDomOverlay.ts pixelworld_mvp/src/rendering/InteriorCutawaySystem.ts pixelworld_mvp/src/styles.css pixelworld_mvp/tests/interiorCutawaySystem.test.ts
git commit -m "feat: add contextual marquee furniture controls"
```

### Task 5: Full regression and browser QA

**Files:**
- Modify only files required by observed failures.

**Interfaces:**
- Validates the user-visible workflow at `http://127.0.0.1:5173/`.

- [ ] **Step 1: Run the complete automated suite and production build**

Run: `npm test && npm run build`
Expected: 0 failed test files and successful Vite build.

- [ ] **Step 2: Browser-test authored and catalog alignment**

Open a room, enable editing, drag one authored item and one catalog item to each edge, and verify the placement rectangle overlays each sprite's visible alpha pixels without shift.

- [ ] **Step 3: Browser-test marquee actions**

Marquee at least two items without Shift, group them, cancel selection, select one item, duplicate it, return it to the shelf, batch-change layers, rotate, and scale to 300%.

- [ ] **Step 4: Verify persistence and console**

Save, reload, reopen the room, confirm exact edge-fit anchors and 300% scale persist, then verify there are no runtime exceptions or failed asset requests.

- [ ] **Step 5: Sync CodeGraph and commit any QA fixes**

Run: `codegraph sync . && codegraph status .`
Expected: `Index is up to date`.
