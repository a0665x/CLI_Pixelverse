# Map-First HUD and Interior Editor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the village map dominant, enlarge the cutaway to an adaptive 720×495 target, keep controls off furniture, and provide predictable edge-fitted game-style furniture dragging.

**Architecture:** Pure layout and disclosure helpers define geometry and state without Phaser or DOM dependencies. `InteriorCutawaySystem` remains the input/render owner, while `InteriorCutawayDomOverlay` renders fixed chrome, collapsible drawers, contextual commands, and accessible guidance around the clipped room viewport. The outer dashboard retains its existing snapshot/event pipeline but presents only map, heartbeat, live activity, and agent count persistently; detailed panels become stable overlays or drawers.

**Tech Stack:** TypeScript, Phaser 3, Vitest, JavaScript ES modules, Python structural tests, HTML/CSS, Vite, Docker Compose.

## Global Constraints

- Preserve existing saved room layouts, rotations, prefab instance IDs, support relationships, interaction points, and visual offsets.
- Furniture drag, edge fitting, and collision resolution must never rotate or mirror an item automatically.
- Furniture preview performs zero storage writes; only explicit Save persists a layout.
- The village camera remains frozen while an interior cutaway is open.
- Pixel art uses nearest-neighbour rendering; interface text uses high-resolution system fonts.
- Hover explanations must also work with keyboard focus, and touch users must have an explicit help entry point.
- Reduced motion and reduced transparency remain fully supported.
- Preserve unrelated dirty working-tree files and stage only task-owned hunks.

---

### Task 1: Adaptive cutaway geometry and reserved content regions

**Files:**
- Create: `pixelworld_mvp/src/rendering/interiorEditorLayout.ts`
- Create: `pixelworld_mvp/tests/interiorEditorLayout.test.ts`
- Modify: `pixelworld_mvp/src/rendering/InteriorCutawaySystem.ts:109-126`
- Modify: `pixelworld_mvp/tests/interiorCutawaySystem.test.ts`

**Interfaces:**
- Consumes: canvas-space viewport width/height and edit/catalog/selection flags.
- Produces: `interiorEditorLayout(viewportWidth, viewportHeight, options): InteriorEditorLayout`, including `frame`, `header`, `room`, `catalog`, and `inspector` rectangles.
- Produces: `contextToolbarPlacement(selectionBounds, roomRect, toolbarSize): ContextToolbarPlacement` with a viewport-safe side.

- [ ] **Step 1: Write the failing pure layout tests**

```ts
import { describe, expect, it } from 'vitest';
import { contextToolbarPlacement, interiorEditorLayout } from '../src/rendering/interiorEditorLayout';

describe('interior editor layout', () => {
  it('targets the approved 720 by 495 desktop frame', () => {
    const layout = interiorEditorLayout(960, 560, {
      editMode: false,
      catalogExpanded: false,
      inspectorExpanded: false,
    });
    expect(layout.frame).toEqual({ x: 120, y: 33, width: 720, height: 495 });
    expect(layout.room.y).toBeGreaterThanOrEqual(layout.header.y + layout.header.height);
    expect(layout.room.y + layout.room.height).toBeLessThanOrEqual(layout.catalog.y);
  });

  it('keeps every region inside a compact viewport', () => {
    const layout = interiorEditorLayout(640, 360, {
      editMode: true,
      catalogExpanded: true,
      inspectorExpanded: true,
    });
    for (const rect of Object.values(layout)) {
      expect(rect.x).toBeGreaterThanOrEqual(8);
      expect(rect.y).toBeGreaterThanOrEqual(8);
      expect(rect.x + rect.width).toBeLessThanOrEqual(632);
      expect(rect.y + rect.height).toBeLessThanOrEqual(352);
    }
    expect(layout.room.y + layout.room.height).toBeLessThanOrEqual(layout.catalog.y);
  });

  it('flips the contextual toolbar away from room edges', () => {
    const room = { x: 120, y: 72, width: 720, height: 360 };
    expect(contextToolbarPlacement(
      { x: 130, y: 76, width: 80, height: 40 }, room, { width: 210, height: 32 },
    ).side).toBe('below');
    expect(contextToolbarPlacement(
      { x: 730, y: 390, width: 90, height: 35 }, room, { width: 210, height: 32 },
    ).side).toBe('above');
  });
});
```

- [ ] **Step 2: Run the focused test and preserve RED evidence**

Run: `cd pixelworld_mvp && npx vitest run tests/interiorEditorLayout.test.ts`

Expected: FAIL because `interiorEditorLayout.ts` does not exist.

- [ ] **Step 3: Implement the pure geometry module**

```ts
export interface EditorRect { x: number; y: number; width: number; height: number }
export interface InteriorEditorLayout {
  frame: EditorRect;
  header: EditorRect;
  room: EditorRect;
  catalog: EditorRect;
  inspector: EditorRect;
}
export interface InteriorEditorLayoutOptions {
  editMode: boolean;
  catalogExpanded: boolean;
  inspectorExpanded: boolean;
}
export type ContextToolbarSide = 'above' | 'below' | 'left' | 'right';
export interface ContextToolbarPlacement extends EditorRect { side: ContextToolbarSide }

const clamp = (value: number, minimum: number, maximum: number): number =>
  Math.min(maximum, Math.max(minimum, value));

export function interiorEditorLayout(
  viewportWidth: number,
  viewportHeight: number,
  options: InteriorEditorLayoutOptions,
): InteriorEditorLayout {
  const margin = 8;
  const width = Math.min(720, Math.max(320, viewportWidth - margin * 2));
  const height = Math.min(495, Math.max(280, viewportHeight - margin * 2));
  const frame = {
    x: Math.round((viewportWidth - width) / 2),
    y: Math.round((viewportHeight - height) / 2),
    width,
    height,
  };
  const headerHeight = 40;
  const catalogHeight = options.editMode && options.catalogExpanded ? Math.min(112, height * 0.28) : 0;
  const inspectorWidth = options.editMode && options.inspectorExpanded && width >= 620 ? 168 : 0;
  const room = {
    x: frame.x,
    y: frame.y + headerHeight,
    width: frame.width - inspectorWidth,
    height: frame.height - headerHeight - catalogHeight,
  };
  return {
    frame,
    header: { x: frame.x, y: frame.y, width: frame.width, height: headerHeight },
    room,
    catalog: { x: frame.x, y: room.y + room.height, width: frame.width, height: catalogHeight },
    inspector: { x: room.x + room.width, y: room.y, width: inspectorWidth, height: room.height },
  };
}

export function contextToolbarPlacement(
  selection: EditorRect,
  room: EditorRect,
  size: Pick<EditorRect, 'width' | 'height'>,
): ContextToolbarPlacement {
  const gap = 8;
  const above = selection.y - size.height - gap;
  const below = selection.y + selection.height + gap;
  const side: ContextToolbarSide = above >= room.y ? 'above'
    : below + size.height <= room.y + room.height ? 'below'
      : selection.x + selection.width / 2 < room.x + room.width / 2 ? 'right' : 'left';
  const desiredX = side === 'right' ? selection.x + selection.width + gap
    : side === 'left' ? selection.x - size.width - gap
      : selection.x + (selection.width - size.width) / 2;
  const desiredY = side === 'above' ? above
    : side === 'below' ? below
      : selection.y + (selection.height - size.height) / 2;
  return {
    side,
    x: clamp(desiredX, room.x, room.x + room.width - size.width),
    y: clamp(desiredY, room.y, room.y + room.height - size.height),
    width: size.width,
    height: size.height,
  };
}
```

- [ ] **Step 4: Route the cutaway through the new geometry**

Replace the fixed `480×330` / `608×360` branch in `cutawayLayoutForViewport` with the `frame` returned from `interiorEditorLayout`. Keep the exported `CutawayLayout` shape for callers and derive `roomViewportFrame` from the reserved `room` rectangle rather than `ROOM_CONTENT_TOP` and `ROOM_CONTENT_BOTTOM` constants.

```ts
export function cutawayLayoutForViewport(viewportWidth: number, viewportHeight: number): CutawayLayout {
  return interiorEditorLayout(viewportWidth, viewportHeight, {
    editMode: false,
    catalogExpanded: false,
    inspectorExpanded: false,
  }).frame;
}
```

Add integration expectations for 960×560, 800×450, and 640×360, including a room frame that never overlaps the catalog rectangle.

- [ ] **Step 5: Run tests, typecheck, and commit**

Run: `cd pixelworld_mvp && npx vitest run tests/interiorEditorLayout.test.ts tests/interiorCutawaySystem.test.ts && npm run typecheck`

Expected: all focused tests PASS and TypeScript exits 0.

```bash
git add pixelworld_mvp/src/rendering/interiorEditorLayout.ts pixelworld_mvp/src/rendering/InteriorCutawaySystem.ts pixelworld_mvp/tests/interiorEditorLayout.test.ts pixelworld_mvp/tests/interiorCutawaySystem.test.ts
git commit -m "feat: enlarge the adaptive interior workspace"
```

### Task 2: Contextual cutaway chrome, drawers, and guide affordances

**Files:**
- Modify: `pixelworld_mvp/src/rendering/InteriorCutawayDomOverlay.ts`
- Modify: `pixelworld_mvp/src/rendering/InteriorCutawaySystem.ts`
- Modify: `pixelworld_mvp/src/rendering/interiorLocale.ts`
- Modify: `pixelworld_mvp/src/styles.css`
- Modify: `pixelworld_mvp/tests/interiorCutawaySystem.test.ts`
- Modify: `pixelworld_mvp/tests/interiorLocale.test.ts`
- Modify: `pixelworld_mvp/tests/gameConfig.test.ts`

**Interfaces:**
- Consumes: `InteriorEditorLayout` from Task 1 and the existing `CutawayDomModel` selection/template state.
- Produces: `CutawayDisclosureState` and handlers `toggleCatalog`, `toggleInspector`, `toggleGuide`, and `fitView`.
- Preserves: all current edit commands and locale catalogs.

- [ ] **Step 1: Add failing DOM and locale tests**

```ts
it('keeps room content clear until contextual drawers are requested', () => {
  overlay.mount(model({ editMode: true, selected: undefined, catalogExpanded: false }));
  expect(host.querySelector('.cutaway-dom-catalog')?.hasAttribute('hidden')).toBe(true);
  expect(host.querySelector('.cutaway-dom-inspector')?.hasAttribute('hidden')).toBe(true);
  expect(host.querySelector('.cutaway-dom-header')).not.toBeNull();
});

it('exposes every icon action through an accessible tooltip', () => {
  overlay.mount(model({ editMode: true, selected: selectedFurniture(), guideMode: false }));
  const buttons = [...host.querySelectorAll<HTMLButtonElement>('button[data-tooltip]')];
  expect(buttons.length).toBeGreaterThan(0);
  expect(buttons.every((button) => Boolean(button.getAttribute('aria-label')))).toBe(true);
});
```

Add all new strings to `zh-TW`, `en-US`, `ja-JP`, and `ko-KR`: catalog, properties, help, fit view, close guide, valid placement, collision, and returned to origin. Assert English serialization contains no CJK characters.

```ts
const editorChrome = {
  'zh-TW': { catalog: '家具庫', properties: '屬性', help: '操作說明', fitView: '符合畫面', closeGuide: '知道了', validPlacement: '可以放置', collision: '位置衝突', returnedToOrigin: '已返回原位' },
  'en-US': { catalog: 'Furniture', properties: 'Properties', help: 'Help', fitView: 'Fit view', closeGuide: 'Got it', validPlacement: 'Valid placement', collision: 'Placement blocked', returnedToOrigin: 'Returned to origin' },
  'ja-JP': { catalog: '家具', properties: 'プロパティ', help: '操作ガイド', fitView: '全体表示', closeGuide: '了解', validPlacement: '配置できます', collision: '配置できません', returnedToOrigin: '元の位置に戻しました' },
  'ko-KR': { catalog: '가구', properties: '속성', help: '사용 안내', fitView: '화면 맞춤', closeGuide: '확인', validPlacement: '배치 가능', collision: '배치할 수 없음', returnedToOrigin: '원래 위치로 돌아감' },
} as const;
```

- [ ] **Step 2: Run the focused tests and preserve RED evidence**

Run: `cd pixelworld_mvp && npx vitest run tests/interiorCutawaySystem.test.ts tests/interiorLocale.test.ts tests/gameConfig.test.ts`

Expected: FAIL because the model lacks disclosure state and the current inspector/catalog are permanently positioned over room content.

- [ ] **Step 3: Extend the model and handlers**

Add these exact fields and methods:

```ts
export interface CutawayDisclosureState {
  catalogExpanded: boolean;
  inspectorExpanded: boolean;
  guideMode: boolean;
}

export interface CutawayDomHandlers {
  toggleCatalog(): void;
  toggleInspector(): void;
  toggleGuide(): void;
  fitView(): void;
}
```

Initialize catalog and inspector collapsed. Selecting furniture may reveal the contextual toolbar, but must not automatically open the full property sheet. Persist only guide dismissal in `pixelworld:guide-dismissed:v1`; disclosure state resets when a room closes.

- [ ] **Step 4: Rebuild the overlay into non-overlapping regions**

Use semantic DOM ownership:

```html
<section class="cutaway-dom-panel">
  <header class="cutaway-dom-header"></header>
  <div class="cutaway-context-toolbar" hidden></div>
  <aside class="cutaway-dom-inspector" hidden></aside>
  <section class="cutaway-dom-catalog" hidden></section>
  <div class="cutaway-guide-popover" role="tooltip" hidden></div>
  <div class="cutaway-room-labels"></div>
</section>
```

The header contains room title/status and icon buttons for edit, catalog, properties, help, fit, and close. Put the existing batch command buttons into `.cutaway-context-toolbar`; compute its location with `contextToolbarPlacement`. Put scale/rotation/layer detail in the inspector sheet. Keep catalog pagination inside the bottom drawer.

- [ ] **Step 5: Add reserved-region CSS and accessible tooltips**

```css
.cutaway-dom-panel { position: absolute; pointer-events: none; font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", Inter, "Noto Sans TC", system-ui, sans-serif; }
.cutaway-dom-header { position: absolute; inset: 0 0 auto; min-height: 40px; pointer-events: auto; }
.cutaway-dom-catalog { position: absolute; inset: auto 0 0; pointer-events: auto; overflow: clip; }
.cutaway-dom-inspector { position: absolute; inset: 40px 0 0 auto; pointer-events: auto; overflow: auto; }
.cutaway-context-toolbar { position: absolute; z-index: 4; display: flex; flex-wrap: wrap; pointer-events: auto; }
.cutaway-dom-panel button[data-tooltip] { position: relative; }
.cutaway-dom-panel button[data-tooltip]::after { content: attr(data-tooltip); position: absolute; opacity: 0; pointer-events: none; }
.cutaway-dom-panel button[data-tooltip]:hover::after,
.cutaway-dom-panel button[data-tooltip]:focus-visible::after { opacity: 1; }
@media (prefers-reduced-motion: reduce) { .cutaway-context-toolbar, .cutaway-guide-popover { transition: none; } }
@media (prefers-reduced-transparency: reduce) { .cutaway-dom-header, .cutaway-dom-catalog, .cutaway-dom-inspector { backdrop-filter: none; background: #16231f; } }
```

Hook labels render as compact icon badges until hover, focus, selection, or guide mode. Agent bubbles remain short and are clamped away from selected furniture.

- [ ] **Step 6: Run tests, typecheck, and commit**

Run: `cd pixelworld_mvp && npx vitest run tests/interiorCutawaySystem.test.ts tests/interiorLocale.test.ts tests/gameConfig.test.ts && npm run typecheck`

Expected: all focused tests PASS and TypeScript exits 0.

```bash
git add pixelworld_mvp/src/rendering/InteriorCutawayDomOverlay.ts pixelworld_mvp/src/rendering/InteriorCutawaySystem.ts pixelworld_mvp/src/rendering/interiorLocale.ts pixelworld_mvp/src/styles.css pixelworld_mvp/tests/interiorCutawaySystem.test.ts pixelworld_mvp/tests/interiorLocale.test.ts pixelworld_mvp/tests/gameConfig.test.ts
git commit -m "feat: keep interior controls clear of furniture"
```

### Task 3: Closest-edge fitting and stable game-style drag feedback

**Files:**
- Modify: `pixelworld_mvp/src/rendering/interiorPlacement.ts`
- Modify: `pixelworld_mvp/src/rendering/interiorSelection.ts`
- Create: `pixelworld_mvp/src/rendering/interiorDragPresentation.ts`
- Modify: `pixelworld_mvp/src/rendering/InteriorCutawaySystem.ts`
- Modify: `pixelworld_mvp/src/styles.css`
- Modify: `pixelworld_mvp/tests/interiorPlacement.test.ts`
- Modify: `pixelworld_mvp/tests/interiorSelection.test.ts`
- Create: `pixelworld_mvp/tests/interiorDragPresentation.test.ts`
- Modify: `pixelworld_mvp/tests/interiorCutawaySystem.test.ts`

**Interfaces:**
- Consumes: transformed opaque bounds and `previewSelectionMove` atomic validation.
- Produces: `fitBoundsDeltaToRoom(room, bounds): GridPoint` and `dragPresentation(diagnostic, phase, reducedMotion): DragPresentation`.
- Preserves: pointer grab offset, current rotation, group geometry, explicit Save semantics, and room-pan input priority.

- [ ] **Step 1: Add failing edge and drag-state tests**

```ts
it.each([
  [{ x: -40, y: 4 }, { x: 0, y: 4 }],
  [{ x: 40, y: 4 }, { x: 17, y: 4 }],
  [{ x: 4, y: -30 }, { x: 4, y: 0 }],
  [{ x: 4, y: 30 }, { x: 4, y: 11 }],
  [{ x: -40, y: -30 }, { x: 0, y: 0 }],
])('fits a fully outside item to the closest edge', (pointer, expected) => {
  const candidate = resolvePlacementCandidate(room18x12, [], oneCellDesk, pointer);
  expect(candidate.furniture.point).toEqual(expected);
  expect(candidate.furniture.rotation).toBe(oneCellDesk.rotation);
});

it('fits a group with one shared delta and preserves its geometry', () => {
  const preview = previewSelectionMove(room18x12, groupedLayout, groupedIds, { x: -30, y: 0 });
  const moved = preview.layout.filter((item) => groupedIds.includes(item.id));
  expect(moved[1]!.point.x - moved[0]!.point.x).toBe(
    groupedLayout[1]!.point.x - groupedLayout[0]!.point.x,
  );
  expect(moved.every((item, index) => item.rotation === groupedLayout[index]!.rotation)).toBe(true);
});

it('does not write or commit while previewing a drag', () => {
  handlers.onDragMove(pointerOutsideRoom);
  expect(storage.setItem).not.toHaveBeenCalled();
  expect(undoStore.length).toBe(0);
});
```

- [ ] **Step 2: Run focused tests and preserve RED evidence**

Run: `cd pixelworld_mvp && npx vitest run tests/interiorPlacement.test.ts tests/interiorSelection.test.ts tests/interiorDragPresentation.test.ts tests/interiorCutawaySystem.test.ts`

Expected: fully outside candidates remain outside because both fit helpers short-circuit on `intersectsRoom`.

- [ ] **Step 3: Implement one closest-edge projection**

```ts
export function fitBoundsDeltaToRoom(
  room: Pick<InteriorDefinition, 'width' | 'height'>,
  bounds: FurnitureBounds,
): GridPoint {
  if (bounds.width > room.width || bounds.height > room.height) return { x: 0, y: 0 };
  const minimumX = -bounds.x;
  const maximumX = room.width - (bounds.x + bounds.width);
  const minimumY = -bounds.y;
  const maximumY = room.height - (bounds.y + bounds.height);
  return {
    x: minimumX > 0 ? minimumX : maximumX < 0 ? maximumX : 0,
    y: minimumY > 0 ? minimumY : maximumY < 0 ? maximumY : 0,
  };
}
```

Use it from `fitFurniturePointToRoom` and `fitSelectionToRoom`. Remove both `intersectsRoom` early returns. For selections, compute bounds once and translate every member by the same delta. Keep oversized candidates unchanged so final atomic validation rejects them without inventing a rotation or scale.

- [ ] **Step 4: Add pure presentation state and integrate pointer ownership**

```ts
export type DragPhase = 'idle' | 'lifting' | 'dragging' | 'settling' | 'returning';
export interface DragPresentation {
  scale: number;
  alpha: number;
  tone: 'neutral' | 'valid' | 'invalid';
  durationMs: number;
}

export function dragPresentation(
  diagnostic: PlacementDiagnostic,
  phase: DragPhase,
  reducedMotion: boolean,
): DragPresentation {
  const invalid = diagnostic !== 'valid';
  return {
    scale: reducedMotion || phase === 'idle' ? 1 : phase === 'dragging' || phase === 'lifting' ? 1.035 : 1,
    alpha: phase === 'dragging' ? 0.94 : 1,
    tone: phase === 'idle' ? 'neutral' : invalid ? 'invalid' : 'valid',
    durationMs: reducedMotion ? 0 : phase === 'returning' ? 140 : 90,
  };
}
```

Capture `{ pointerId, selectedIds, startLayout, grabOffset }` once on pointer-down. During pointer-move, update only the in-memory preview and sprite presentation. On pointer-up, commit one accepted candidate or render one return animation from `startLayout`. Clear capture on pointer-cancel, room close, direct room switch, and destroy.

- [ ] **Step 5: Verify interaction ownership and persistence**

Add handler-level tests proving:

```ts
expect(villageCamera.pan).not.toHaveBeenCalled();
expect(roomViewport.pan).not.toHaveBeenCalled();
expect(storage.setItem).not.toHaveBeenCalled();
expect(currentLayout.map(({ rotation }) => rotation)).toEqual(originalRotations);
expect(undoStore.length).toBe(successfulDrop ? 1 : 0);
```

Also cover valid/invalid outline state, reduced motion, pointer cancel, dropped collision, group support relationships, and consecutive edge moves without alternating with the original point.

- [ ] **Step 6: Run tests, typecheck, and commit**

Run: `cd pixelworld_mvp && npx vitest run tests/interiorPlacement.test.ts tests/interiorSelection.test.ts tests/interiorDragPresentation.test.ts tests/interiorCutawaySystem.test.ts && npm run typecheck`

Expected: all focused tests PASS and TypeScript exits 0.

```bash
git add pixelworld_mvp/src/rendering/interiorPlacement.ts pixelworld_mvp/src/rendering/interiorSelection.ts pixelworld_mvp/src/rendering/interiorDragPresentation.ts pixelworld_mvp/src/rendering/InteriorCutawaySystem.ts pixelworld_mvp/src/styles.css pixelworld_mvp/tests/interiorPlacement.test.ts pixelworld_mvp/tests/interiorSelection.test.ts pixelworld_mvp/tests/interiorDragPresentation.test.ts pixelworld_mvp/tests/interiorCutawaySystem.test.ts
git commit -m "fix: make interior furniture dragging edge-stable"
```

### Task 4: Map-first dashboard and progressive disclosure

**Files:**
- Create: `public/dashboard_disclosure.mjs`
- Modify: `public/index.html`
- Modify: `public/app.mjs`
- Create: `tests/test_dashboard_disclosure.mjs`
- Modify: `tests/test_dashboard_layout.py`

**Interfaces:**
- Consumes: existing `currentSnapshot`, `renderTimelinePanels`, heartbeat elements, agent counts, and Pixelworld iframe.
- Produces: `readDashboardDisclosure`, `writeDashboardDisclosure`, `toggleDashboardDrawer`, and `shouldShowGuide`.
- Preserves: existing event rendering, resize controls, locale propagation, live snapshot publication, and backend endpoints.

- [ ] **Step 1: Add failing disclosure and structural tests**

```js
import assert from 'node:assert/strict';
import test from 'node:test';
import {
  readDashboardDisclosure,
  shouldShowGuide,
  toggleDashboardDrawer,
} from '../public/dashboard_disclosure.mjs';

test('secondary drawers start collapsed while core HUD stays visible', () => {
  const initial = readDashboardDisclosure(null);
  assert.deepEqual(initial, {
    activeDrawer: null,
    guideDismissed: false,
  });
  const open = toggleDashboardDrawer(initial, 'timeline');
  assert.deepEqual(open, { activeDrawer: 'timeline', guideDismissed: false });
  assert.deepEqual(toggleDashboardDrawer({ ...open, guideDismissed: true }, 'timeline'), {
    activeDrawer: null,
    guideDismissed: true,
  });
});

test('guide appears once and remains keyboard discoverable', () => {
  assert.equal(shouldShowGuide({ guideDismissed: false }, 'pointer'), true);
  assert.equal(shouldShowGuide({ guideDismissed: false }, 'keyboard'), true);
  assert.equal(shouldShowGuide({ guideDismissed: true }, 'pointer'), false);
});
```

Extend `test_dashboard_layout.py` to assert that `pixelworld-frame`, `heartbeat-status`, one `aria-live` current-state node, and agent counts are outside drawer containers; timeline and diagnostic panels must have `hidden` or collapsed state initially.

- [ ] **Step 2: Run Node and Python RED tests**

Run: `node --test tests/test_dashboard_disclosure.mjs && python -m pytest tests/test_dashboard_layout.py -q`

Expected: FAIL because the disclosure module and map-first drawer contract do not exist.

- [ ] **Step 3: Implement disclosure state**

```js
const STORAGE_KEY = 'pixelverse:dashboard-disclosure:v1';

export function readDashboardDisclosure(storage) {
  if (!storage) return { activeDrawer: null, guideDismissed: false };
  try {
    const value = JSON.parse(storage.getItem(STORAGE_KEY) || 'null');
    const activeDrawer = ['timeline', 'agents', 'diagnostics'].includes(value?.activeDrawer)
      ? value.activeDrawer : null;
    return { activeDrawer, guideDismissed: value?.guideDismissed === true };
  } catch {
    return { activeDrawer: null, guideDismissed: false };
  }
}

export function writeDashboardDisclosure(storage, state) {
  try { storage?.setItem(STORAGE_KEY, JSON.stringify(state)); } catch { return false; }
  return true;
}

export function toggleDashboardDrawer(state, requested) {
  return {
    ...state,
    activeDrawer: state.activeDrawer === requested ? null : requested,
  };
}

export function shouldShowGuide(state, modality) {
  return state.guideDismissed !== true && (modality === 'pointer' || modality === 'keyboard' || modality === 'touch');
}
```

Use `toggleDashboardDrawer` directly from `app.mjs`; render drawer visibility by setting `.hidden`, `aria-expanded`, and `aria-controls` rather than removing event content from the DOM.

- [ ] **Step 4: Recompose the page into map, HUD, and drawers**

Use this ownership structure inside `public/index.html`:

```html
<main class="map-first-workspace">
  <section class="map-stage" aria-label="Agent village">
    <iframe id="pixelworld-frame" class="pixelworld-frame" src="/pixelworld/index.html?embed=1"></iframe>
    <aside class="live-hud" aria-label="Live agent status">
      <div id="heartbeat-status"></div>
      <div id="current-agent-state" aria-live="polite"></div>
      <div class="agent-counts"><span id="agent-count">0</span><span id="subagent-count">0</span></div>
    </aside>
    <nav class="workspace-tools" aria-label="Workspace details"></nav>
  </section>
  <aside class="workspace-drawer" id="workspace-drawer" hidden></aside>
</main>
```

Move existing timeline, agent/detail, and diagnostic sections into drawer panels without changing their IDs or render functions. Keep their data updated while hidden. Replace permanent explanatory copy with `data-tooltip`, `aria-label`, and a first-use guide popover.

- [ ] **Step 5: Add map-first responsive and accessibility styles**

```css
.map-first-workspace { position: fixed; inset: 0; overflow: hidden; background: #07100d; }
.map-stage { position: absolute; inset: 0; min-width: 0; min-height: 0; }
.pixelworld-frame { width: 100%; height: 100%; border: 0; display: block; }
.live-hud { position: absolute; top: 14px; left: 14px; z-index: 6; display: grid; gap: 6px; max-width: min(420px, calc(100% - 92px)); }
.workspace-tools { position: absolute; top: 14px; right: 14px; z-index: 7; display: flex; gap: 8px; }
.workspace-drawer { position: absolute; z-index: 8; inset: 68px 14px 14px auto; width: min(420px, calc(100% - 28px)); overflow: auto; }
.workspace-drawer[hidden] { display: none; }
@media (max-width: 720px) { .workspace-drawer { inset: auto 8px 8px; width: auto; max-height: 44vh; } }
@media (prefers-reduced-transparency: reduce) { .live-hud, .workspace-drawer { backdrop-filter: none; background: #101916; } }
```

Retain the existing Apple material tokens and immediate pointer-down feedback only on functional controls. Do not apply glass to the map or timeline content itself.

- [ ] **Step 6: Run dashboard suites and commit exact hunks**

Run: `node --test tests/test_dashboard_disclosure.mjs tests/test_workbench_layout.mjs tests/test_agent_timeline_graphs.mjs tests/test_pixelworld_embed.mjs`

Run: `python -m pytest tests/test_dashboard_layout.py tests/test_fastapi_service.py -q`

Expected: all selected Node and Python tests PASS.

Because `public/index.html` and `public/app.mjs` already contain unrelated user changes, inspect and stage only the map-first owning hunks with `git diff` and `git add -p`.

```bash
git add public/dashboard_disclosure.mjs tests/test_dashboard_disclosure.mjs tests/test_dashboard_layout.py
git add -p public/index.html public/app.mjs
git diff --cached --check
git commit -m "feat: make the live village map the primary workspace"
```

### Task 5: Cross-system regression, live browser QA, and deployment

**Files:**
- Modify only when a reproducible scoped defect requires a TDD fix.
- Write report: `.superpowers/sdd/map-first-hud-interior-editor-report.md`
- Write screenshots: `.superpowers/sdd/map-first-hud-interior-editor-artifacts/screenshots/`

**Interfaces:**
- Consumes: Tasks 1–4 as one browser-facing release.
- Produces: verified port 5661 deployment, CodeGraph synchronization, screenshots, and a limitations report.

- [ ] **Step 1: Run fresh automated suites**

Run:

```bash
node --test tests/*.mjs
python -m pytest -q
cd pixelworld_mvp
npm run typecheck
npx vitest run
npm run build
```

Expected: every Node test passes; Python passes with only explicitly conditional environment skips; all Pixelworld tests pass; typecheck and build exit 0. Record the existing Vite large-chunk advisory separately if it remains non-fatal.

- [ ] **Step 2: Review the complete scoped diff**

Run:

```bash
git diff --check
git status --short
git log --oneline -8
```

Confirm no purchased Modern Office asset is committed, no saved layout fixture changed unintentionally, and unrelated dirty files remain unstaged.

- [ ] **Step 3: Rebuild through the ordinary entrypoint**

Run: `./run.sh start`

Expected: `/health` returns `ok: true`; the container revision label matches exact `git rev-parse HEAD`; the Modern Office mount is read-only; `/`, `/pixelworld/index.html`, and required asset requests return HTTP 200.

- [ ] **Step 4: Perform desktop and compact browser QA**

At `http://127.0.0.1:5661/`, verify:

1. The village fills the primary workspace with heartbeat and current activity visible.
2. Timeline, agents, and diagnostics start collapsed and open without resizing the map unexpectedly.
3. Hover and keyboard focus expose tooltips; the first-use guide can be dismissed and reopened.
4. Research, Maker, and Collaboration cutaways open near 720×495 on desktop and fit inside compact viewports.
5. Header, catalog, inspector, labels, and batch toolbar do not cover lower furniture.
6. Room wheel zoom and empty-space pan still work; furniture drag owns the pointer when grabbed.
7. Drag each of a single item and a complete prefab beyond left, right, top, bottom, and a corner; previews remain attached to the pointer and settle at the closest edge.
8. Collision drop returns once without oscillation; successful drop produces one undo entry and zero storage writes before Save.
9. Rotation, support relationships, prefab instance IDs, and saved layout survive Save plus reload.
10. Reduced-motion and reduced-transparency modes remain usable.

- [ ] **Step 5: Inspect runtime evidence and synchronize CodeGraph**

Capture desktop, compact, expanded catalog, contextual toolbar, edge-fit, and simplified dashboard screenshots. Confirm no application console error, no HTTP 4xx/5xx, and no private asset loading failure.

Run:

```bash
codegraph sync
codegraph status
```

Expected: the index reports up to date. Write exact test counts, image revision, browser checks, screenshots, known advisories, and any explicitly unverified long-path interaction into the report.

## Acceptance Criteria

- The desktop cutaway targets 720×495 and remains fully viewport-safe on compact screens.
- No permanent header, catalog, inspector, batch column, Hook label, or long agent text covers usable room furniture.
- Fully outside single and grouped furniture fits to the nearest room edge without geometry drift, rotation change, snap-back oscillation, or preview storage writes.
- The map, heartbeat, current live execution state, and agent summary are continuously visible; secondary details are collapsed but accessible.
- Tooltips, keyboard focus, guide mode, reduced motion, and reduced transparency work.
- Existing layouts, groups, support relationships, room pan/zoom, undo, and Save/reload behavior remain compatible.
- Automated suites, typecheck, production build, ordinary deployment, health checks, browser console/network checks, and CodeGraph synchronization pass.
