# Adaptive Live Rails Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver continuously animated agent ECGs, independently resizable adaptive side rails, and one authoritative agent display model shared by the rails and village.

**Architecture:** Add focused pure modules for agent display normalization, ECG animation, and rail resizing. Keep `public/app.mjs` as the integration owner and use CSS custom properties for the five-column workspace. Backend snapshots remain event-driven; only SVG presentation is animated locally.

**Tech Stack:** ES modules, DOM Pointer Events, SVG, CSS Grid/custom properties, Node test runner, pytest structural tests, Playwright browser QA.

## Global Constraints

- Preserve the village as the primary surface.
- Use no page or rail scrollbars.
- Do not increase backend polling frequency.
- Genuine idle/offline agents remain visible; only redundant stale placeholders are suppressed.
- Desktop rail widths persist; narrow layout ignores them.
- Preserve unrelated dirty worktree changes and purchased assets.

---

### Task 1: Authoritative Agent Display Model

**Files:**
- Modify: `public/live_agent_rails.mjs`
- Modify: `public/app.mjs`
- Test: `tests/test_live_agent_rails.mjs`

**Interfaces:**
- Produces: `normalizeVisibleAgents(snapshot): object[]`
- Produces: `resolvedAgentActivity(agent): { state, tone, load, semantic, roomKey }`
- Consumed by: rail rendering, Hook rendering, village rendering, and Pixelworld snapshot publication.

- [ ] **Step 1: Write failing tests** for attached-agent placeholder suppression, genuine offline retention, active-state precedence over `pixel_state=idle`, and consistent semantic/room output.
- [ ] **Step 2: Run RED** with `node --test tests/test_live_agent_rails.mjs` and confirm only the new contracts fail.
- [ ] **Step 3: Implement the pure normalizer** and route the normalized snapshot through all four consumers in `renderSnapshot`.
- [ ] **Step 4: Run GREEN** with the focused Node tests and confirm the active CLI is the only main character when the redundant placeholder is present.

### Task 2: Display-Synced ECG Controller

**Files:**
- Create: `public/live_ecg_controller.mjs`
- Create: `tests/test_live_ecg_controller.mjs`
- Modify: `public/live_agent_rails.mjs`
- Modify: `public/app.mjs`

**Interfaces:**
- Produces: `createLiveEcgController({ root, now, requestFrame, cancelFrame, reducedMotion }): { sync(rows), start(), stop() }`
- Consumes: normalized rail rows containing `id`, `state`, `tone`, and `load`.

- [ ] **Step 1: Write failing tests** proving unchanged snapshots still yield different active paths, idle/offline remain flat, the frame rate is capped, reduced motion is static, and stop cancels the scheduled frame.
- [ ] **Step 2: Run RED** with `node --test tests/test_live_ecg_controller.mjs`.
- [ ] **Step 3: Implement the controller** so it mutates only existing `[data-agent-ecg] path` elements and never rebuilds rail cards per frame.
- [ ] **Step 4: Integrate lifecycle setup/cleanup** in `public/app.mjs` and run focused GREEN tests.

### Task 3: Resizable Adaptive Workspace

**Files:**
- Create: `public/live_rail_layout.mjs`
- Create: `tests/test_live_rail_layout.mjs`
- Modify: `public/app.mjs`
- Modify: `public/index.html`
- Test: `tests/test_dashboard_layout.py`

**Interfaces:**
- Produces: `createLiveRailLayoutController(options)` with `start()`, `destroy()`, and `reset(side)`.
- Persists: `pixelverse:live-left-width` and `pixelverse:live-right-width`.
- Sets: `--live-left-width`, `--live-right-width`, and rail density data attributes.

- [ ] **Step 1: Write failing pure tests** for clamp math, map minimum preservation, pointer deltas, keyboard increments, storage validation, and reset values.
- [ ] **Step 2: Write failing structural tests** for two accessible separators, five-column desktop grid, compact narrow fallback, and no scrollbars.
- [ ] **Step 3: Run RED** with the new Node test plus `pytest tests/test_dashboard_layout.py -q`.
- [ ] **Step 4: Implement the controller** with pointer capture, immediate CSS-variable updates, keyboard support, double-click reset, persistence, and viewport reclamping.
- [ ] **Step 5: Implement adaptive CSS** for compact/standard/wide agent cards and desktop/narrow layout.
- [ ] **Step 6: Run focused GREEN** and syntax checks.

### Task 4: Dense Hook Console and Integration Verification

**Files:**
- Modify: `public/live_agent_rails.mjs`
- Modify: `public/app.mjs`
- Modify: `public/index.html`
- Modify: `public/i18n/en-US.mjs`
- Modify: `public/i18n/zh-TW.mjs`
- Modify: `public/i18n/ja-JP.mjs`
- Modify: `public/i18n/ko-KR.mjs`
- Test: `tests/test_live_agent_rails.mjs`
- Test: `tests/test_dashboard_layout.py`

**Interfaces:**
- Produces: `hookChannelsForAgents(agents, locale)` returning Work/Search/Rest channel summaries.
- Consumes: the authoritative normalized agent list from Task 1.

- [ ] **Step 1: Write failing tests** for three Hook channels, occupant counts, freshest activity, localized labels, and selected-channel emphasis.
- [ ] **Step 2: Run RED**, then implement the compact console without historical statistics or scroll containers.
- [ ] **Step 3: Run all focused tests**, then full Node, Python, Pixelworld, typecheck, and production build.
- [ ] **Step 4: Rebuild with `./run.sh start`** on port 5661 and perform browser QA at 1440×900, 1024×768, and 800×450, including live splitter dragging and active CLI/village parity.
- [ ] **Step 5: Run an independent read-only review**, resolve any Critical/Important findings test-first, then sync and verify CodeGraph as the final repository operation.
