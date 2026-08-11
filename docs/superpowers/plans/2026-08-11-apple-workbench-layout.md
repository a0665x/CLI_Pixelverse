# Apple-style Resizable Pixelverse Workbench Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add directly draggable dashboard regions and a full-village default viewport with fluid zoom controls.

**Architecture:** Keep the existing dashboard DOM and introduce a small pure `workbench_layout.mjs` module for clamping, storage, and pointer-derived dimensions. Keep Pixelworld scaling in a focused TypeScript viewport model consumed by `createGame`, with an embedded DOM control forwarding zoom input to that model.

**Tech Stack:** Browser Pointer Events, CSS custom properties/Grid, localStorage, Phaser 3, TypeScript, Vitest, Node test runner.

## Global Constraints

- Preserve the existing dashboard features and legacy furniture edit compatibility.
- Default village view must contain the complete 768×448 world.
- Pointer drag feedback is one-to-one and uses pointer capture.
- Layout persists locally and malformed saved data fails safely.
- Respect reduced-motion, reduced-transparency, and increased-contrast preferences.

---

### Task 1: Resizable workbench boundaries

**Files:**
- Create: `public/workbench_layout.mjs`
- Create: `tests/test_workbench_layout.mjs`
- Modify: `public/index.html`
- Modify: `public/app.mjs`

**Interfaces:**
- Produces: `clampSidebarWidth(value, viewportWidth)`, `clampTimelineHeight(value, viewportHeight)`, `layoutFromPointer(axis, startValue, startPointer, currentPointer, viewport)`, `readWorkbenchLayout(storage)`, and `writeWorkbenchLayout(storage, layout)`.

- [ ] Write Node tests proving clamping, one-to-one pointer deltas, and malformed-storage fallback.
- [ ] Run `node --test tests/test_workbench_layout.mjs` and confirm missing-module/function failures.
- [ ] Implement the pure module and rerun the focused tests to green.
- [ ] Add semantic vertical/horizontal separator elements with pointer capture, keyboard arrows, double-click reset, CSS-variable updates, and saved state.
- [ ] Add Apple-style pressed/material/reduced-motion/reduced-transparency/high-contrast CSS.
- [ ] Run `node --test tests/*.mjs` and confirm all Node tests pass.

### Task 2: Full-village fit and zoom model

**Files:**
- Create: `pixelworld_mvp/src/game/villageViewport.ts`
- Create: `pixelworld_mvp/tests/villageViewport.test.ts`
- Modify: `pixelworld_mvp/src/game/constants.ts`
- Modify: `pixelworld_mvp/src/game/createGame.ts`
- Modify: `pixelworld_mvp/src/main.ts`
- Modify: `pixelworld_mvp/src/styles.css`
- Modify: `pixelworld_mvp/index.html`

**Interfaces:**
- Produces: `fitScaleFor(width, height)`, `clampZoomMultiplier(value)`, and `VillageViewportController` with `zoomIn()`, `zoomOut()`, `fit()`, `setAvailableSize(width, height)`, and `apply()`.

- [ ] Write Vitest cases for fractional contain-fit, centering, zoom clamps, fit reset, and resize preservation.
- [ ] Run `npm test -- --run tests/villageViewport.test.ts` and confirm missing-module/function failures.
- [ ] Implement the viewport model and use it from Phaser's ResizeObserver callback.
- [ ] Add embedded zoom controls and wheel handling with immediate pressed feedback and accessible labels.
- [ ] Run the focused test and then `npm test -- --run && npm run build`.

### Task 3: Integrated QA and service rebuild

**Files:**
- Modify only if QA exposes defects in the files listed above.

**Interfaces:**
- Consumes the dashboard separators and `VillageViewportController` from Tasks 1 and 2.

- [ ] Run `python3 -m pytest -q -o faulthandler_timeout=10`, `node --test tests/*.mjs`, and `git diff --check`.
- [ ] Run `PIXELVERSE_PORT=5661 PIXELVERSE_FLOORPLAN=default PIXELVERSE_REBUILD=1 PIXELVERSE_AGENT_KIND=codex PIXELVERSE_EXPOSURE_MODE=localhost ./run.sh start`.
- [ ] Browser-test initial full-village containment, both separators, reload persistence, zoom out/Fit/in, mobile layout, iframe readiness, and console errors.
- [ ] Run `codegraph sync .` and confirm the index is current.
