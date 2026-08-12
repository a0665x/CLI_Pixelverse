# Village Observability and Viewport Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver a cover-first, zoomable and pannable localized village while moving verbose agent state into the live event timeline.

**Architecture:** Keep canonical snapshots in the outer dashboard and add a small versioned locale bridge alongside the existing snapshot bridge. Extend the pure Pixelworld viewport model to own framing, pointer-anchored zoom, pan bounds, and session state; DOM wiring only translates gestures into model operations. Derive timeline live-state presentation from existing agent snapshot fields and reduce map overlays to concise bubbles.

**Tech Stack:** JavaScript ES modules, TypeScript, Phaser 3, DOM Pointer Events, CSS, Node test runner, Vitest, Pytest, Vite.

## Global Constraints

- Do not change tilemap dimensions, building coordinates, A* graph, or backend snapshot schema.
- Embedded village defaults to Cover; standalone village defaults to Fit.
- Gesture-driven camera movement must track input immediately without CSS transitions.
- Locale changes must not reload the iframe or reset camera state.
- Preserve furniture editing, building click, live-agent, and responsive behavior.
- Support `zh-TW`, `en-US`, `ja-JP`, and `ko-KR`, plus reduced motion, transparency, and increased contrast.

---

### Task 1: Pure Camera Model

**Files:**
- Modify: `pixelworld_mvp/src/game/VillageViewportController.ts`
- Test: `pixelworld_mvp/tests/villageViewport.test.ts`

**Interfaces:**
- Produces `ViewportFrameMode = 'cover' | 'fit' | 'free'`.
- Produces camera metrics containing `scale`, rendered size, and `offsetX/offsetY`.
- Produces pointer-anchored `zoomAt`, bounded `panBy`, `cover`, `fit`, `resize`, and session serialization APIs.

- [ ] Write failing tests proving cover fills both axes, fit contains both axes, pointer zoom preserves the underlying world coordinate, pan clamps to visible bounds, resize preserves a free camera, and malformed persisted state resets safely.
- [ ] Run `npm test -- --run tests/villageViewport.test.ts` and verify failures are caused by missing APIs.
- [ ] Implement the minimum camera math and controller state needed by the tests.
- [ ] Re-run the focused tests and `npm run typecheck`; expect zero failures.

### Task 2: Locale Bridge and Pixelworld Copy

**Files:**
- Create: `pixelworld_mvp/src/i18n/villageLocale.ts`
- Modify: `pixelworld_mvp/src/live/LiveWorldClient.ts`
- Modify: `pixelworld_mvp/src/main.ts`
- Modify: `pixelworld_mvp/src/rendering/StatusOverlaySystem.ts`
- Modify: `pixelworld_mvp/src/rendering/domStatusOverlay.ts`
- Modify: `pixelworld_mvp/src/rendering/InteriorCutawayDomOverlay.ts`
- Modify: `pixelworld_mvp/src/world/worldDefinition.ts`
- Modify: `public/pixelworld_embed.mjs`
- Modify: `public/app.mjs`
- Test: `pixelworld_mvp/tests/villageLocale.test.ts`
- Test: `pixelworld_mvp/tests/liveWorldClient.test.ts`
- Test: `tests/test_pixelworld_embed.mjs`

**Interfaces:**
- Consumes `pixelverse.locale.update` parent messages with `{ locale, sequence }`.
- Produces localized building, state, bubble, occupancy, cutaway, category, and viewport-control strings.
- Outer publisher sends the active locale on initialization, locale change, and iframe-ready notification.

- [ ] Write failing tests for locale validation/fallback, all required copy keys, locale message parsing, and outer message publishing.
- [ ] Run focused Node/Vitest tests and confirm expected failures.
- [ ] Implement the locale catalog, bridge parser/publisher, and live update subscriptions.
- [ ] Replace hard-coded visible Pixelworld labels with catalog lookups while retaining stable building IDs.
- [ ] Re-run focused tests and typecheck; expect zero failures.

### Task 3: Concise Map Bubbles and Timeline Live State

**Files:**
- Modify: `pixelworld_mvp/src/rendering/StatusOverlaySystem.ts`
- Modify: `pixelworld_mvp/src/rendering/domStatusOverlay.ts`
- Modify: `public/agent_timeline_graphs.mjs`
- Modify: `public/app.mjs`
- Modify: `public/index.html`
- Test: `pixelworld_mvp/tests/statusOverlaySystem.test.ts`
- Test: `tests/test_agent_timeline_graphs.mjs`

**Interfaces:**
- Map overlay exposes only a concise localized speech bubble outdoors.
- Timeline panels expose `stateLabel`, `roomLabel`, `taskLabel`, `heartbeatTone`, and `ageSeconds` from canonical snapshot data.

- [ ] Write failing tests proving verbose outdoor agent chips are suppressed and timeline view models retain localized current state, room, task, heartbeat, and age.
- [ ] Run focused tests and verify expected failures.
- [ ] Implement concise bubble rendering and enhanced timeline view models/cards.
- [ ] Add accessible live-state pills and glass styling without changing event lanes.
- [ ] Re-run focused tests; expect zero failures.

### Task 4: Direct-Manipulation Camera Wiring

**Files:**
- Modify: `pixelworld_mvp/src/game/createGame.ts`
- Modify: `pixelworld_mvp/src/main.ts`
- Modify: `pixelworld_mvp/src/styles.css`
- Test: `pixelworld_mvp/tests/gameConfig.test.ts`
- Test: `pixelworld_mvp/tests/villageViewport.test.ts`

**Interfaces:**
- Embedded mode initializes Cover; standalone mode initializes Fit.
- Wheel calls `zoomAt` using coordinates relative to the game viewport.
- Pointer drag uses capture, a movement threshold, 1:1 tracking, and click suppression only after drag commitment.
- Controls invoke zoom out, cover/fit, zoom in, and accessible reset behavior.

- [ ] Write failing tests for embedded default framing, session restoration, and presentation style output.
- [ ] Run focused tests and confirm failures.
- [ ] Wrap/apply canvas presentation using scale and translation owned by the camera controller.
- [ ] Wire wheel, pointer capture drag, framing controls, and session persistence.
- [ ] Add cover-friendly background, glass controls, pointer-down feedback, and accessibility media queries.
- [ ] Re-run focused tests, typecheck, and build; expect zero failures.

### Task 5: Live Rebuild and Acceptance QA

**Files:**
- Verify only unless a browser-reproduced defect requires a TDD fix.

**Interfaces:**
- Live URL remains `http://127.0.0.1:5661/`.

- [ ] Run `node --test tests/*.mjs`, `npm test && npm run build` in `pixelworld_mvp`, and `python -m pytest -q`; expect all suites to pass.
- [ ] Rebuild the existing `cli-pixelverse` Docker service with the saved compose environment.
- [ ] Browser-test four locale switches and assert no stale Chinese building/control copy in non-Chinese modes.
- [ ] Browser-test initial Cover, Fit, pointer-centered wheel zoom, drag pan, reload persistence, building click after a non-drag click, responsive breakpoints, and console errors.
- [ ] Run a read-only final code review, fix Critical/Important findings using a failing test first, and re-run all verification.
- [ ] Sync CodeGraph and confirm the service and `/api/world` are healthy.

## Self-Review

- Spec coverage: camera, locale, overlay simplification, timeline observability, layout, Apple materials, accessibility, persistence, and QA each map to a task.
- Placeholder scan: no deferred implementation placeholders remain.
- Type consistency: the camera, locale message, and timeline view-model interfaces use the same names throughout the plan.
