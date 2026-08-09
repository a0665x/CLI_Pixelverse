# Interior Furniture Editor UX Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make furniture drag, placement, resizing, labels, and saved layouts direct, readable, and persistent.

**Architecture:** Keep geometry, collision diagnostics, resizing, and versioned persistence in the pure `interiorLayoutEditor.ts` model. Keep Phaser pointer objects and preview rendering in `InteriorCutawaySystem.ts`; the sprite itself owns the gesture and only valid drops mutate the model. Existing indoor A* continues consuming `furnitureCells`, so scaled furniture automatically changes navigation obstacles.

**Tech Stack:** TypeScript, Phaser 3.90, Vitest, Vite, browser localStorage.

## Global Constraints

- Supported furniture scales are exactly `0.75`, `1`, `1.25`, and `1.5`.
- Only furniture with `supportedActions.length > 0` receives a persistent label.
- Saved layouts remain building-specific and migrate existing unversioned arrays to version 2.
- Invalid drops and resizes never mutate the layout.
- Room movement remains orthogonal grid-based A*.

---

### Task 1: Scaled Furniture Geometry and Placement Diagnostics

**Files:**
- Modify: `pixelworld_mvp/src/world/types.ts`
- Modify: `pixelworld_mvp/src/rendering/interiorLayoutEditor.ts`
- Test: `pixelworld_mvp/tests/interiorLayoutEditor.test.ts`
- Test: `pixelworld_mvp/tests/interiorMotion.test.ts`

**Interfaces:**
- Produces: `FurnitureScale`, `FURNITURE_SCALES`, `normalizeFurnitureScale(scale)`, `placementDiagnostic(room, candidate, layout, ignoreId?)`, and `resizeFurniture(room, layout, furnitureId, scale)`.
- Preserves: `furnitureCells`, `canPlaceFurniture`, `moveFurniture`, and `addFurniture`.

- [ ] **Step 1: Write failing geometry and diagnostic tests**

```ts
expect(furnitureCells({ kind: 'sofa', point: { x: 4, y: 4 }, scale: 1.5 })).toHaveLength(9);
expect(placementDiagnostic(room, overlapping, layout)).toBe('overlap');
expect(placementDiagnostic(room, atDoor, layout)).toBe('blocks-door');
expect(resizeFurniture(room, layout, 'rest-sofa-a', 1.25).find(({ id }) => id === 'rest-sofa-a')?.scale).toBe(1.25);
expect(resizeFurniture(room, layout, 'rest-sofa-a', 1.5)).toEqual(layout);
```

- [ ] **Step 2: Run focused tests and verify RED**

Run: `npm test -- --run tests/interiorLayoutEditor.test.ts tests/interiorMotion.test.ts`

Expected: FAIL because scaled footprints, diagnostics, and resizing do not exist.

- [ ] **Step 3: Implement scaled footprints and reasoned placement**

```ts
export const FURNITURE_SCALES = [0.75, 1, 1.25, 1.5] as const;
export type FurnitureScale = (typeof FURNITURE_SCALES)[number];
export type PlacementDiagnostic = 'valid' | 'outside-room' | 'blocks-door' | 'overlap';

export function normalizeFurnitureScale(value: unknown): FurnitureScale {
  return FURNITURE_SCALES.includes(value as FurnitureScale) ? value as FurnitureScale : 1;
}

// Scale each semantic footprint axis with Math.ceil. placementDiagnostic checks
// bounds, then the entrance, then other furniture cells in that order.
```

`canPlaceFurniture` returns `placementDiagnostic(...) === 'valid'`. `moveFurniture`, `resizeFurniture`, and `addFurniture` clone data and never mutate rejected layouts. New palette items receive `scale: 1`.

- [ ] **Step 4: Verify GREEN**

Run: `npm test -- --run tests/interiorLayoutEditor.test.ts tests/interiorMotion.test.ts`

Expected: all focused tests PASS and indoor A* avoids every scaled cell.

### Task 2: Versioned Persistent Layouts

**Files:**
- Modify: `pixelworld_mvp/src/rendering/interiorLayoutEditor.ts`
- Test: `pixelworld_mvp/tests/interiorLayoutEditor.test.ts`

**Interfaces:**
- Consumes: `normalizeFurnitureScale` and placement validation from Task 1.
- Produces: version-2 `{ version: 2, furniture: FurnitureDefinition[] }` persistence while accepting legacy arrays.

- [ ] **Step 1: Write failing migration and round-trip tests**

```ts
saveInteriorLayout('house-a', [{ ...item, scale: 1.25 }], storage);
expect(JSON.parse(storage.getItem('pixelworld:interior-layout:house-a')!)).toMatchObject({ version: 2 });
expect(loadInteriorLayout('house-a', room, storage)[0]?.scale).toBe(1.25);
storage.setItem(key, JSON.stringify(room.furniture));
expect(loadInteriorLayout('house-a', room, storage).every(({ scale }) => scale === 1)).toBe(true);
```

- [ ] **Step 2: Run test and verify RED**

Run: `npm test -- --run tests/interiorLayoutEditor.test.ts`

Expected: FAIL because storage currently writes a raw array and does not normalize scale.

- [ ] **Step 3: Implement migration and validated version-2 writes**

```ts
interface SavedInteriorLayoutV2 { version: 2; furniture: FurnitureDefinition[] }
storage?.setItem(storageKey(buildingId), JSON.stringify({ version: 2, furniture: cloneLayout(layout) }));
const source = Array.isArray(parsed) ? parsed : parsed?.version === 2 ? parsed.furniture : undefined;
```

Normalize every loaded scale, preserve supported Hook actions, validate geometry in order, and fall back to the authored layout on malformed or unusable data.

- [ ] **Step 4: Verify GREEN**

Run: `npm test -- --run tests/interiorLayoutEditor.test.ts`

Expected: migration, persistence, corrupted input, and building isolation tests PASS.

### Task 3: Direct Dragging and Live Footprint Preview

**Files:**
- Modify: `pixelworld_mvp/src/rendering/InteriorCutawaySystem.ts`
- Test: `pixelworld_mvp/tests/interiorCutawaySystem.test.ts`

**Interfaces:**
- Consumes: `placementDiagnostic`, `moveFurniture`, `addFurniture`, and scaled `furnitureCells`.
- Produces: sprite-owned drag gestures and a green/red grid preview.

- [ ] **Step 1: Write failing Phaser interaction tests**

```ts
expect(furnitureSprite.interactive).toBe(true);
furnitureSprite.emit('drag', {}, targetX, targetY);
expect({ x: furnitureSprite.x, y: furnitureSprite.y }).toEqual({ x: targetX, y: targetY });
expect(preview.lastFillColor).toBe(VALID_PREVIEW_COLOR);
furnitureSprite.emit('dragend');
expect(savedModelPoint).toEqual(snappedRoomPoint);
```

Also verify an invalid candidate renders red, keeps the original model point, and returns the sprite to its source coordinates.

- [ ] **Step 2: Run test and verify RED**

Run: `npm test -- --run tests/interiorCutawaySystem.test.ts`

Expected: FAIL because an invisible zone owns the drag and no live preview exists.

- [ ] **Step 3: Implement direct drag sessions**

Make each placed sprite interactive and draggable. During `drag`, set the sprite position directly, calculate the snapped candidate, and redraw a footprint graphics layer with green `0x67d391` or red `0xe56b67`. During `dragend`, commit only `valid`, otherwise restore the sprite and show the diagnostic-specific Chinese status message.

Palette drags create a temporary preview sprite so the source item remains stationary and reusable. Increase palette spacing/hit area and apply the same preview/commit path.

- [ ] **Step 4: Verify GREEN**

Run: `npm test -- --run tests/interiorCutawaySystem.test.ts tests/interiorLayoutEditor.test.ts`

Expected: direct drag, snapping, preview colors, rejected-drop rollback, and palette reuse tests PASS.

### Task 4: Double-click Size Inspector and Hook-only Labels

**Files:**
- Modify: `pixelworld_mvp/src/rendering/InteriorCutawaySystem.ts`
- Test: `pixelworld_mvp/tests/interiorCutawaySystem.test.ts`
- Test: `pixelworld_mvp/tests/interiorLayoutEditor.test.ts`

**Interfaces:**
- Consumes: `FURNITURE_SCALES`, `resizeFurniture`, and `FurnitureDefinition.supportedActions`.
- Produces: `− 100% ＋` inspector and high-resolution Hook labels.

- [ ] **Step 1: Write failing inspector and label tests**

```ts
hookSprite.emit('pointerdown', pointer);
hookSprite.emit('pointerdown', { ...pointer, downTime: pointer.downTime + 200 });
expect(textValues).toEqual(expect.arrayContaining(['－', '100%', '＋']));
expect(labelTexts).toContain('使用工具');
expect(labelTexts).not.toContain('PLANT');
expect(hookLabel.setResolution).toHaveBeenCalledWith(expect.any(Number));
```

- [ ] **Step 2: Run test and verify RED**

Run: `npm test -- --run tests/interiorCutawaySystem.test.ts`

Expected: FAIL because there is no selection/inspector and every kind currently gets a 5px label.

- [ ] **Step 3: Implement selection, resizing, and readable labels**

Detect two pointer-down events on the same sprite within 320ms. Show an inspector beside the selected furniture with minus, percentage, and plus controls. Controls choose the neighboring allowed scale and call `resizeFurniture`; rejected sizes keep the old value and show the reason.

Render labels only when `supportedActions.length > 0`. Use action-oriented Chinese copy, `sans-serif`, source font size 9–10px, high contrast padding, and `setResolution(Math.max(2, window.devicePixelRatio || 1))`.

- [ ] **Step 4: Verify GREEN**

Run: `npm test -- --run tests/interiorCutawaySystem.test.ts tests/interiorLayoutEditor.test.ts tests/interiorMotion.test.ts`

Expected: inspector, bounded resize, Hook-only labels, and scaled A* tests PASS.

### Task 5: Full Verification and Browser QA

**Files:**
- Modify only if a verified QA defect requires it.

**Interfaces:**
- Verifies all prior tasks without adding new scope.

- [ ] **Step 1: Run all automated checks**

Run:

```bash
cd pixelworld_mvp
npm test -- --run
npm run build
cd ..
python -m pytest -q
```

Expected: all Vitest and Python tests PASS; TypeScript and Vite build exit 0.

- [ ] **Step 2: Browser QA at `http://127.0.0.1:5173/`**

Verify a placed item follows the pointer, valid/invalid previews are visible, palette items remain reusable, double-click shows the size inspector, resizing changes collision, only Hook furniture has readable labels, Save survives reload, and Console/Network have no application errors.

- [ ] **Step 3: Synchronize CodeGraph**

Run: `codegraph sync && codegraph status`

Expected: `Index is up to date`.
