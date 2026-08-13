# Furniture Drag Stability Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Preserve source-authored furniture orientation and make cutaway furniture previews stay attached to the pointer until one final commit or rollback on drag end.

**Architecture:** Separate authored-orientation normalization from interaction-facing semantics. Add a pure drag-preview result that exposes the proposed fitted selection even when atomic validation rejects it; the cutaway renderer uses the preview during drag while retaining the accepted-only layout for commit.

**Tech Stack:** TypeScript, Phaser 3, Vitest, Vite, Docker Compose, raw Chromium/CDP browser QA.

## Global Constraints

- Missing `rotation` means source orientation `0`; `facing` never implicitly rotates sprites.
- Explicit authored, saved, prefab, or user rotations remain unchanged.
- Invalid drag candidates stay under the pointer as a red preview and restore only once at drag end.
- Collision, door, room, Hook, support, and aisle validation remain strict.
- No storage write occurs until explicit Save.
- Preserve all unrelated dirty and untracked workspace files.

---

### Task 1: Preserve Source Orientation

**Files:**
- Modify: `pixelworld_mvp/src/rendering/interiorLayoutEditor.ts`
- Test: `pixelworld_mvp/tests/interiorLayoutEditor.test.ts`

**Interfaces:**
- Consumes: `normalizeRotation(value)` and saved `FurnitureDefinition.rotation`.
- Produces: normalized layouts where `rotation === normalizeRotation(item.rotation ?? 0)`.

- [ ] **Step 1: Write failing orientation tests**

Add cases that load an authored and legacy item with `facing: 'right'` or `facing: 'left'` and no `rotation`, then assert the returned rotation is `0`. Add a case with explicit `rotation: 270` and assert it remains `270`.

- [ ] **Step 2: Verify RED**

Run: `cd pixelworld_mvp && npm test -- --run tests/interiorLayoutEditor.test.ts`

Expected: missing-rotation cases fail with received `90`/`270`.

- [ ] **Step 3: Remove facing-derived rotation**

Replace the normalization expression with:

```ts
rotation: normalizeRotation(item.rotation ?? 0),
```

Delete `rotationFromFacing`; retain `facing` unchanged for interaction semantics.

- [ ] **Step 4: Verify GREEN and commit**

Run the focused test and `npm run typecheck`, then commit only the source and direct test with `fix: preserve authored furniture orientation`.

---

### Task 2: Keep Invalid Drag Preview Attached

**Files:**
- Modify: `pixelworld_mvp/src/rendering/interiorSelection.ts`
- Modify: `pixelworld_mvp/src/rendering/InteriorCutawaySystem.ts`
- Test: `pixelworld_mvp/tests/interiorSelection.test.ts`
- Test: `pixelworld_mvp/tests/InteriorCutawaySystem.test.ts`

**Interfaces:**
- Consumes: `moveSelection`, `fitSelectionToRoom`, `selectedMutationIsValid`.
- Produces: `previewSelectionMove(room, layout, selectedIds, delta): SelectionMutationResult` whose `layout` is always the proposed fitted clone and whose `accepted` controls commit only.

- [ ] **Step 1: Write failing pure preview tests**

Create a real selection near another furniture item. Assert an invalid pointer delta returns `accepted: false`, keeps the committed input immutable, and returns the selected item at the proposed fitted/snapped point instead of its origin. Assert a valid group delta moves every member by one shared snapped delta and translates `interactionPoint` equally.

- [ ] **Step 2: Verify RED**

Run: `cd pixelworld_mvp && npm test -- --run tests/interiorSelection.test.ts`.

Expected: import/function failure or invalid preview returns the original layout.

- [ ] **Step 3: Implement pure preview and retain atomic wrapper**

Implement:

```ts
export function previewSelectionMove(...): SelectionMutationResult {
  const proposed = /* move once, fit once, clone */;
  return { accepted: selectedMutationIsValid(...), layout: proposed };
}

export function moveSelectionAtomically(...): SelectionMutationResult {
  const preview = previewSelectionMove(...);
  return { accepted: preview.accepted, layout: preview.accepted ? preview.layout : cloneLayout(layout) };
}
```

The existing public atomic contract remains unchanged for buttons and non-drag mutations.

- [ ] **Step 4: Write failing runtime drag tests**

Drive `dragstart → invalid drag → valid drag → dragend` through the Phaser test double. Assert the preview sprite never returns to origin between drag frames, only the final accepted layout enters undo, pointer grab offset remains stable, and invalid dragend re-renders the original exactly once without a history entry.

- [ ] **Step 5: Wire cutaway drag session**

During `drag`, call `previewSelectionMove`; render its proposed selected items regardless of `accepted`; color via `drawSelectionPreview(preview, accepted)`. During `dragend`, commit only when accepted. Keep a single root-local grab offset and clear preview/mutation/grab state on drag end, render cancellation, close, and resize rebuild.

- [ ] **Step 6: Verify GREEN and commit**

Run focused selection/cutaway/placement tests and `npm run typecheck`, then commit only the two source and direct test files with `fix: stabilize furniture drag previews`.

---

### Task 3: Regression, Browser QA, and Deployment

**Files:**
- Modify only if Task 1–2 QA exposes a regression in their listed files.
- Record: `.superpowers/sdd/furniture-drag-stability-report.md`

**Interfaces:**
- Consumes: completed orientation and drag-preview contracts.
- Produces: verified service at `http://127.0.0.1:5661/` and current CodeGraph.

- [ ] **Step 1: Run all automated gates**

Run:

```bash
node --test tests/*.mjs
python -m pytest -q
cd pixelworld_mvp
npm run typecheck
npm test -- --run
npm run build
```

Expected: zero failures; the existing Vite large-chunk advisory may remain.

- [ ] **Step 2: Real-pointer browser QA**

Using raw Chromium/CDP input, open a work room, enable editing, and drag:

- one explicitly rotated authored item;
- one missing-rotation/legacy fixture or shelf item;
- one single item through valid and colliding cells;
- one built-in prefab group from an edge grab.

Assert angle stays unchanged, preview remains attached through invalid frames, red/green state changes without origin flicker, invalid release rolls back once, and valid release persists after Save/reload.

- [ ] **Step 3: Deploy and attest**

Run `./run.sh start`; verify `/health`, `/`, `/pixelworld/index.html`, image revision equals `git rev-parse HEAD`, and Modern Office mount is read-only.

- [ ] **Step 4: Refresh CodeGraph and report**

Run `codegraph sync . && codegraph status .`; require `Index is up to date`. Record exact tests, browser evidence, revision, health, and any limitation in the report.
